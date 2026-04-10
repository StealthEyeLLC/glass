//! Live-session WebSocket **skeleton** (additive; **not** final live mode).
//!
//! Polls the collector over **provisional F-IPC** on a bounded interval and emits small JSON notices when
//! the bounded snapshot fingerprint changes. This is **replacement/bounded** semantics — **not** an
//! append-only durable event stream.
//!
//! Live-era WS-only reasons ([`LIVE_WS_REASON_*`]) are **separate** from frozen bounded HTTP
//! [`crate::resync::RESYNC_HINT_REASON_*`] tokens.

use std::collections::VecDeque;
use std::time::Duration;

use axum::extract::ws::{Message, WebSocket};
use glass_collector::ipc::{
    FipcCollectorToBridge, FIPC_SNAPSHOT_ORIGIN_UNKNOWN_OR_EMPTY,
    PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS,
};
use serde_json::{json, Value};

use crate::ipc_client::{fetch_bounded_snapshot, FipcClientError};
use crate::{AppState, CollectorIpcClientConfig};

/// Wire protocol version for [`crate::live_session_ws`] messages (`type: glass.bridge.live_session.v1`).
pub const LIVE_SESSION_WS_PROTOCOL_V1: u32 = 1;

/// Default poll interval when `GLASS_BRIDGE_LIVE_WS_POLL_MS` is unset (**provisional**).
pub const PROVISIONAL_LIVE_WS_POLL_INTERVAL_MS: u64 = 200;

/// Max outbound JSON lines queued per connection before **`session_resync_required`** (**provisional**).
pub const PROVISIONAL_LIVE_WS_OUTBOUND_QUEUE_MAX: usize = 64;

/// Max events embedded in a `session_snapshot_replaced` payload (**provisional**; full view via HTTP snapshot).
pub const PROVISIONAL_LIVE_WS_EVENTS_SAMPLE_MAX: usize = 16;

/// Live-era / additive — **WebSocket only**; **not** HTTP `resync_hint.reason` (F-04 bounded frozen).
pub const LIVE_WS_REASON_QUEUE_OVERFLOW: &str = "live_ws_outbound_queue_overflow_provisional";

/// Live-era / additive — snapshot RPC failed; client should use HTTP snapshot or retry.
pub const LIVE_WS_REASON_POLL_FAILED: &str = "live_ws_snapshot_poll_failed_provisional";

/// Live-era / additive — client should fetch fresh bounded snapshot (HTTP) after overload.
pub const LIVE_WS_REASON_RESYNC_AFTER_WS_OVERLOAD: &str =
    "live_ws_resync_after_overload_provisional";

#[derive(Clone, Debug, PartialEq, Eq)]
struct SnapshotFingerprint {
    snapshot_cursor: String,
    event_len: usize,
    returned_events: u32,
    retained_snapshot_unix_ms: Option<u64>,
    /// Empty string if metadata missing (wire-compat).
    snapshot_origin: String,
}

struct PolledSnapshot {
    fp: SnapshotFingerprint,
    snapshot_cursor: String,
    events: Vec<Value>,
    retained_snapshot_unix_ms: Option<u64>,
    snapshot_origin: String,
    returned_events: u32,
    available_in_view: u32,
    truncated_by_max_events: bool,
}

fn poll_interval_duration() -> Duration {
    std::env::var("GLASS_BRIDGE_LIVE_WS_POLL_MS")
        .ok()
        .and_then(|s| s.parse().ok())
        .filter(|&ms: &u64| (10..=60_000).contains(&ms))
        .map(Duration::from_millis)
        .unwrap_or_else(|| Duration::from_millis(PROVISIONAL_LIVE_WS_POLL_INTERVAL_MS))
}

/// Initial WebSocket hello (extends legacy `glass.bridge.ws.hello`).
pub fn ws_hello_json(state: &AppState) -> Value {
    let ipc = state.collector_ipc.is_some();
    json!({
        "type": "glass.bridge.ws.hello",
        "bridge_api_version": 1,
        "live_delta_stream": false,
        "live_session_delta_skeleton": ipc,
        "live_session_protocol": LIVE_SESSION_WS_PROTOCOL_V1,
        "collector_fipc_configured": ipc,
        "provisional_backlog_event_threshold": crate::resync::PROVISIONAL_BACKLOG_EVENT_THRESHOLD,
        "recovery_strategy": "snapshot_and_cursor",
        "note": "live_session: optional subscribe via {\"msg\":\"live_session_subscribe\",\"session_id\":\"…\",\"protocol\":1}; bounded polling — not production live ingest"
    })
}

pub async fn run_ws_session(mut socket: WebSocket, state: AppState) {
    let hello = ws_hello_json(&state);
    if send_json(&mut socket, &hello).await.is_err() {
        return;
    }

    while let Some(msg) = socket.recv().await {
        let Ok(msg) = msg else {
            break;
        };
        let Message::Text(t) = msg else {
            continue;
        };
        let Ok(v) = serde_json::from_str::<Value>(&t) else {
            continue;
        };
        if v.get("msg").and_then(|x| x.as_str()) != Some("live_session_subscribe") {
            continue;
        }
        let Some(sid) = v.get("session_id").and_then(|x| x.as_str()) else {
            let _ = send_json(
                &mut socket,
                &error_envelope("invalid_subscribe", "session_id required"),
            )
            .await;
            continue;
        };
        if sid.is_empty() {
            let _ = send_json(
                &mut socket,
                &error_envelope("invalid_subscribe", "session_id must be non-empty"),
            )
            .await;
            continue;
        }
        let protocol = v.get("protocol").and_then(|x| x.as_u64()).unwrap_or(1) as u32;
        if protocol != LIVE_SESSION_WS_PROTOCOL_V1 {
            let _ = send_json(
                &mut socket,
                &error_envelope("invalid_protocol", "unsupported live_session protocol"),
            )
            .await;
            continue;
        }
        let Some(cfg) = state.collector_ipc.clone() else {
            let _ = send_json(
                &mut socket,
                &error_envelope(
                    "live_session_unavailable",
                    "collector F-IPC not configured on this bridge",
                ),
            )
            .await;
            continue;
        };

        run_subscribed_loop(&mut socket, cfg, sid.to_string()).await;
        return;
    }
}

async fn run_subscribed_loop(
    socket: &mut WebSocket,
    cfg: CollectorIpcClientConfig,
    session_id: String,
) {
    // Baseline poll **before** `session_hello` so clients do not race ahead and mutate collector state
    // before the skeleton records its fingerprint.
    let mut last_fp = match poll_snapshot(&cfg, &session_id).await {
        Ok(s) => s.fp,
        Err(e) => {
            let _ = send_json(
                socket,
                &warning_envelope(LIVE_WS_REASON_POLL_FAILED, &e.to_string()),
            )
            .await;
            return;
        }
    };

    let sub_hello = json!({
        "type": "glass.bridge.live_session.v1",
        "msg": "session_hello",
        "protocol": LIVE_SESSION_WS_PROTOCOL_V1,
        "session_id": session_id,
        "continuity_model": "bounded_f_ipc_polling_not_durable",
        "honesty": "Updates reflect collector bounded snapshot changes only; retained loops replace tails — not append-only history. Use GET /sessions/:id/snapshot for authoritative bounded contract (F-04)."
    });
    if send_json(socket, &sub_hello).await.is_err() {
        return;
    }

    let mut outbound: VecDeque<String> = VecDeque::new();
    let mut interval = tokio::time::interval(poll_interval_duration());
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        tokio::select! {
            biased;
            _ = interval.tick() => {
                let snap = match poll_snapshot(&cfg, &session_id).await {
                    Ok(s) => s,
                    Err(e) => {
                        let _ = send_json(socket, &warning_envelope(LIVE_WS_REASON_POLL_FAILED, &e.to_string())).await;
                        continue;
                    }
                };
                if snap.fp == last_fp {
                    continue;
                }
                let line = snapshot_replaced_envelope(&session_id, &snap);
                if push_queue(&mut outbound, line) {
                    let _ = send_json(
                        socket,
                        &resync_required_envelope(LIVE_WS_REASON_RESYNC_AFTER_WS_OVERLOAD),
                    )
                    .await;
                    outbound.clear();
                    let _ = push_queue(&mut outbound, snapshot_replaced_envelope(&session_id, &snap));
                }
                if flush_outbound(socket, &mut outbound).await.is_err() {
                    break;
                }
                last_fp = snap.fp;
            }
            msg = socket.recv() => {
                let Some(Ok(msg)) = msg else { break };
                match msg {
                    Message::Text(t) => {
                        if let Ok(v) = serde_json::from_str::<Value>(&t) {
                            if v.get("msg").and_then(|x| x.as_str()) == Some("live_session_unsubscribe") {
                                break;
                            }
                        }
                    }
                    Message::Ping(p) => {
                        let _ = socket.send(Message::Pong(p)).await;
                    }
                    Message::Close(_) => break,
                    _ => {}
                }
            }
        }
    }
}

/// Returns `true` if overflow (caller should emit `session_resync_required` and clear).
fn push_queue(queue: &mut VecDeque<String>, item: String) -> bool {
    if queue.len() >= PROVISIONAL_LIVE_WS_OUTBOUND_QUEUE_MAX {
        return true;
    }
    queue.push_back(item);
    false
}

async fn flush_outbound(socket: &mut WebSocket, queue: &mut VecDeque<String>) -> Result<(), ()> {
    while let Some(line) = queue.pop_front() {
        socket.send(Message::text(line)).await.map_err(|_| ())?;
    }
    Ok(())
}

async fn poll_snapshot(
    cfg: &CollectorIpcClientConfig,
    session_id: &str,
) -> Result<PolledSnapshot, FipcClientError> {
    let cap = (PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS as u32).clamp(1, 256);
    let reply = fetch_bounded_snapshot(
        cfg.addr,
        cfg.shared_secret.as_ref(),
        session_id,
        None,
        cap,
        cfg.timeout,
    )
    .await?;
    let (snapshot_cursor, events, retained_snapshot_unix_ms, snapshot_meta) = match reply {
        FipcCollectorToBridge::BoundedSnapshotReply {
            snapshot_cursor,
            events,
            retained_snapshot_unix_ms,
            snapshot_meta,
            ..
        } => (
            snapshot_cursor,
            events,
            retained_snapshot_unix_ms,
            snapshot_meta,
        ),
        other => return Err(FipcClientError::Unexpected(Box::new(other))),
    };
    let (returned_events, available_in_view, truncated_by_max_events, origin) =
        match snapshot_meta.as_ref() {
            Some(m) => (
                m.returned_events,
                m.available_in_view,
                m.truncated_by_max_events,
                m.snapshot_origin.clone(),
            ),
            None => (
                events.len() as u32,
                events.len() as u32,
                false,
                String::new(),
            ),
        };
    let snapshot_origin = if origin.is_empty() {
        FIPC_SNAPSHOT_ORIGIN_UNKNOWN_OR_EMPTY.to_string()
    } else {
        origin
    };
    let fp = SnapshotFingerprint {
        snapshot_cursor: snapshot_cursor.clone(),
        event_len: events.len(),
        returned_events,
        retained_snapshot_unix_ms,
        snapshot_origin: snapshot_origin.clone(),
    };
    Ok(PolledSnapshot {
        fp,
        snapshot_cursor,
        events,
        retained_snapshot_unix_ms,
        snapshot_origin,
        returned_events,
        available_in_view,
        truncated_by_max_events,
    })
}

fn snapshot_replaced_envelope(session_id: &str, s: &PolledSnapshot) -> String {
    let take = s.events.len().min(PROVISIONAL_LIVE_WS_EVENTS_SAMPLE_MAX);
    let sample: Vec<Value> = s.events.iter().take(take).cloned().collect();
    let omitted = s.events.len().saturating_sub(take);
    let v = json!({
        "type": "glass.bridge.live_session.v1",
        "msg": "session_snapshot_replaced",
        "protocol": LIVE_SESSION_WS_PROTOCOL_V1,
        "session_id": session_id,
        "snapshot_cursor": s.snapshot_cursor,
        "snapshot_origin": s.snapshot_origin,
        "returned_events": s.returned_events,
        "available_in_view": s.available_in_view,
        "truncated_by_max_events": s.truncated_by_max_events,
        "retained_snapshot_unix_ms": s.retained_snapshot_unix_ms,
        "continuity": "bounded_replacement_not_append_only",
        "honesty": "Derived from F-IPC bounded snapshot polls; not a durable delta log. Full envelope + frozen resync contract: GET /sessions/:id/snapshot",
        "events_sample": sample,
        "events_omitted_from_sample": omitted,
    });
    v.to_string()
}

fn resync_required_envelope(reason: &'static str) -> Value {
    json!({
        "type": "glass.bridge.live_session.v1",
        "msg": "session_resync_required",
        "protocol": LIVE_SESSION_WS_PROTOCOL_V1,
        "reason": reason,
        "action": "use_http_snapshot",
        "honesty": "Additive live-era notice — not bounded F-04 HTTP resync_hint tokens"
    })
}

fn warning_envelope(code: &'static str, detail: &str) -> Value {
    json!({
        "type": "glass.bridge.live_session.v1",
        "msg": "session_warning",
        "protocol": LIVE_SESSION_WS_PROTOCOL_V1,
        "code": code,
        "detail": detail,
    })
}

fn error_envelope(code: &'static str, detail: &str) -> Value {
    json!({
        "type": "glass.bridge.ws.error",
        "code": code,
        "detail": detail,
    })
}

async fn send_json(socket: &mut WebSocket, v: &Value) -> Result<(), ()> {
    socket
        .send(Message::text(v.to_string()))
        .await
        .map_err(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn push_queue_overflow_signal() {
        let mut q = VecDeque::new();
        for i in 0..PROVISIONAL_LIVE_WS_OUTBOUND_QUEUE_MAX {
            assert!(!push_queue(&mut q, format!("{i}")));
        }
        assert!(push_queue(&mut q, "overflow".into()));
    }

    #[test]
    fn live_ws_reasons_distinct_from_bounded_http_tokens() {
        assert!(!LIVE_WS_REASON_QUEUE_OVERFLOW.contains("bounded_truncation"));
        assert!(!crate::resync::RESYNC_HINT_REASON_BOUNDED_TRUNCATION.is_empty());
    }
}

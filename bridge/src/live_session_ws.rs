//! Live-session WebSocket path: bounded F-IPC **polling** + per-connection outbound queue (F-03 v0).
//!
//! Polls the collector over **provisional F-IPC** on a bounded interval and emits JSON when the bounded
//! snapshot fingerprint changes. This is **replacement/bounded** semantics — **not** an append-only durable
//! event stream.
//!
//! Live-era WS-only reasons ([`LIVE_WS_REASON_*`]) are **separate** from frozen bounded HTTP
//! [`crate::resync::RESYNC_HINT_REASON_*`] tokens.
//!
//! **F-03 v0 (frozen for this module):** per-connection queue; max **events** OR max **UTF-8 bytes** (sum of
//! queued line lengths) triggers coalesce to the **latest** `session_snapshot_replaced` payload, then a
//! mandatory `session_resync_required` — no silent continuity. See `docs/F03_LIVE_BACKLOG_FREEZE_PROPOSAL.md`
//! and `docs/PHASE0_FREEZE_TRACKER.md`.

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

/// F-03 v0: max queued outbound JSON **messages** (lines) per WebSocket before coalesce + escalate.
pub const F03_V0_LIVE_WS_QUEUE_MAX_EVENTS: usize = 64;

/// F-03 v0: max sum of **UTF-8 byte lengths** (`str::len()`) of queued outbound JSON lines per connection.
pub const F03_V0_LIVE_WS_QUEUE_MAX_BYTES: usize = 256 * 1024;

/// Max events embedded in a `session_snapshot_replaced` payload (**provisional**; full view via HTTP snapshot).
pub const PROVISIONAL_LIVE_WS_EVENTS_SAMPLE_MAX: usize = 16;

/// Live-era / additive — **WebSocket only**; **not** HTTP `resync_hint.reason` (F-04 bounded frozen).
pub const LIVE_WS_REASON_QUEUE_OVERFLOW: &str = "live_ws_outbound_queue_overflow_v0";

/// Live-era / additive — snapshot RPC failed; client must use HTTP snapshot or retry.
pub const LIVE_WS_REASON_POLL_FAILED: &str = "live_ws_snapshot_poll_failed_v0";

/// Live-era / additive — mandatory resync after F-03 coalesce/escalate (queue threshold).
pub const LIVE_WS_REASON_RESYNC_AFTER_WS_OVERLOAD: &str = "live_ws_resync_after_overload_v0";

/// Live-era / additive — bounded snapshot fingerprint jumped without a explainable single-replace path (honesty hook).
pub const LIVE_WS_REASON_CONTINUITY_LOST_FINGERPRINT_GAP: &str =
    "live_ws_continuity_lost_fingerprint_gap_v0";

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

/// Result of attempting to queue one outbound JSON line with F-03 coalescing.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum F03PushOutcome {
    /// Queued without coalescing.
    Queued,
    /// Pending messages were dropped from the queue and replaced with latest + `session_resync_required`.
    CoalescedEscalated,
}

/// Per-connection outbound queue: counts **messages** and **UTF-8 bytes** (sum of `str::len()` per line).
#[derive(Debug, Default)]
pub(crate) struct F03OutboundQueue {
    deque: VecDeque<String>,
    total_bytes: usize,
}

impl F03OutboundQueue {
    pub(crate) fn new() -> Self {
        Self::default()
    }

    #[cfg(test)]
    pub(crate) fn len(&self) -> usize {
        self.deque.len()
    }

    #[cfg(test)]
    pub(crate) fn total_bytes(&self) -> usize {
        self.total_bytes
    }

    pub(crate) fn clear(&mut self) {
        self.deque.clear();
        self.total_bytes = 0;
    }

    /// Whether adding `new_line` would exceed **either** max_events **or** max_bytes (OR semantics).
    pub(crate) fn would_overflow_adding(
        &self,
        new_line: &str,
        max_events: usize,
        max_bytes: usize,
    ) -> bool {
        let next_events = self.deque.len().saturating_add(1);
        let next_bytes = self.total_bytes.saturating_add(new_line.len());
        next_events > max_events || next_bytes > max_bytes
    }

    fn push_inner(&mut self, line: String) {
        self.total_bytes = self.total_bytes.saturating_add(line.len());
        self.deque.push_back(line);
    }

    /// Enqueue `latest_snapshot_line` (serialized `session_snapshot_replaced`). On threshold violation,
    /// clear pending, enqueue **only** the latest snapshot line, then `session_resync_required`
    /// ([`LIVE_WS_REASON_QUEUE_OVERFLOW`]).
    pub(crate) fn push_snapshot_replaced_or_coalesce(
        &mut self,
        latest_snapshot_line: String,
        max_events: usize,
        max_bytes: usize,
    ) -> F03PushOutcome {
        if self.would_overflow_adding(&latest_snapshot_line, max_events, max_bytes) {
            self.clear();
            self.push_inner(latest_snapshot_line);
            self.push_inner(resync_required_line(LIVE_WS_REASON_QUEUE_OVERFLOW));
            return F03PushOutcome::CoalescedEscalated;
        }
        self.push_inner(latest_snapshot_line);
        F03PushOutcome::Queued
    }

    /// Mandatory continuity / poll-failure resync — never silent. Uses same OR thresholds; coalesces if needed.
    pub(crate) fn push_mandatory_resync(
        &mut self,
        reason: &'static str,
        max_events: usize,
        max_bytes: usize,
    ) -> F03PushOutcome {
        let line = resync_required_line(reason);
        if self.would_overflow_adding(&line, max_events, max_bytes) {
            self.clear();
            self.push_inner(line);
            return F03PushOutcome::CoalescedEscalated;
        }
        self.push_inner(line);
        F03PushOutcome::Queued
    }

    pub(crate) fn pop_front(&mut self) -> Option<String> {
        let line = self.deque.pop_front()?;
        self.total_bytes = self.total_bytes.saturating_sub(line.len());
        Some(line)
    }

    #[cfg(test)]
    pub(crate) fn test_queued_line_strings(&self) -> Vec<&str> {
        self.deque.iter().map(|s| s.as_str()).collect()
    }
}

fn resync_required_line(reason: &'static str) -> String {
    resync_required_envelope(reason).to_string()
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
        "f03_v0_live_ws": {
            "queue_max_events": F03_V0_LIVE_WS_QUEUE_MAX_EVENTS,
            "queue_max_bytes": F03_V0_LIVE_WS_QUEUE_MAX_BYTES,
            "queue_byte_accounting": "utf8_len_per_queued_line_sum",
            "overflow_policy": "coalesce_latest_session_snapshot_replaced_then_session_resync_required",
            "threshold_semantics": "events_or_bytes",
            "resync_on_poll_failure": true,
        },
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
    let max_e = F03_V0_LIVE_WS_QUEUE_MAX_EVENTS;
    let max_b = F03_V0_LIVE_WS_QUEUE_MAX_BYTES;

    // Baseline poll **before** `session_hello` so clients do not race ahead and mutate collector state
    // before the skeleton records its fingerprint.
    let mut last_fp = match poll_snapshot(&cfg, &session_id).await {
        Ok(s) => s.fp,
        Err(e) => {
            let _ = send_json(
                socket,
                &resync_required_envelope(LIVE_WS_REASON_POLL_FAILED),
            )
            .await;
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

    let mut outbound = F03OutboundQueue::new();
    let mut interval = tokio::time::interval(poll_interval_duration());
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

    loop {
        tokio::select! {
            biased;
            _ = interval.tick() => {
                let snap = match poll_snapshot(&cfg, &session_id).await {
                    Ok(s) => s,
                    Err(e) => {
                        let _ = outbound.push_mandatory_resync(LIVE_WS_REASON_POLL_FAILED, max_e, max_b);
                        let _ = flush_outbound(socket, &mut outbound).await;
                        let _ = send_json(socket, &warning_envelope(LIVE_WS_REASON_POLL_FAILED, &e.to_string())).await;
                        continue;
                    }
                };
                if snap.fp == last_fp {
                    continue;
                }

                // Honesty: fingerprint changed — if we cannot explain a single replace step from last_fp, escalate.
                let gap = fingerprint_looks_like_discontinuity(&last_fp, &snap.fp);
                last_fp = snap.fp.clone();

                let line = snapshot_replaced_envelope(&session_id, &snap);
                let outcome = outbound.push_snapshot_replaced_or_coalesce(line, max_e, max_b);
                if gap && outcome != F03PushOutcome::CoalescedEscalated {
                    let _ = outbound.push_mandatory_resync(
                        LIVE_WS_REASON_CONTINUITY_LOST_FINGERPRINT_GAP,
                        max_e,
                        max_b,
                    );
                }

                if flush_outbound(socket, &mut outbound).await.is_err() {
                    break;
                }
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

/// Conservative discontinuity: cursor string regressed while lengths imply a non-replace jump.
/// (F-03 honesty hook — avoids silent “continuity” when metadata is inconsistent.)
fn fingerprint_looks_like_discontinuity(
    prev: &SnapshotFingerprint,
    next: &SnapshotFingerprint,
) -> bool {
    if prev.snapshot_cursor == next.snapshot_cursor {
        return false;
    }
    // Opaque cursors: only flag obvious regression of returned prefix count with same literal cursor class.
    // If both are `v0:off:N` style and N decreases, treat as gap for v0.
    let prev_n = parse_v0_off_n(&prev.snapshot_cursor);
    let next_n = parse_v0_off_n(&next.snapshot_cursor);
    matches!((prev_n, next_n), (Some(a), Some(b)) if a > b)
}

fn parse_v0_off_n(cursor: &str) -> Option<u32> {
    let rest = cursor.strip_prefix("v0:off:")?;
    rest.parse().ok()
}

async fn flush_outbound(socket: &mut WebSocket, queue: &mut F03OutboundQueue) -> Result<(), ()> {
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
        "honesty": "Client must refresh — live WS continuity not assumed. Not bounded F-04 HTTP resync_hint tokens."
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
    fn f03_queue_respects_event_cap_or_semantics() {
        // max_e = 2 → at most two queued lines; the third enqueue triggers coalesce.
        let max_e = 2usize;
        let max_b = 1_000_000;
        let mut q = F03OutboundQueue::new();
        assert_eq!(
            q.push_snapshot_replaced_or_coalesce("a".into(), max_e, max_b),
            F03PushOutcome::Queued
        );
        assert_eq!(
            q.push_snapshot_replaced_or_coalesce("b".into(), max_e, max_b),
            F03PushOutcome::Queued
        );
        let o = q.push_snapshot_replaced_or_coalesce("c".into(), max_e, max_b);
        assert_eq!(o, F03PushOutcome::CoalescedEscalated);
        assert!(q.len() >= 2);
        let lines = q.test_queued_line_strings();
        assert!(lines.iter().any(|l| l.contains("session_resync_required")));
        assert!(lines.contains(&"c"));
    }

    #[test]
    fn f03_queue_respects_byte_cap_or_semantics() {
        let max_e = 100usize;
        let max_b = 9usize;
        let mut q = F03OutboundQueue::new();
        let line = "0123456789"; // 10 UTF-8 bytes
        assert_eq!(
            q.push_snapshot_replaced_or_coalesce(line.into(), max_e, max_b),
            F03PushOutcome::CoalescedEscalated
        );
        assert!(q
            .test_queued_line_strings()
            .iter()
            .any(|l| l.contains("session_resync_required")));
    }

    #[test]
    fn f03_queue_or_either_threshold_triggers() {
        let mut q = F03OutboundQueue::new();
        // Events: max 2 lines — third line triggers coalesce.
        assert_eq!(
            q.push_snapshot_replaced_or_coalesce("x".into(), 2, 9999),
            F03PushOutcome::Queued
        );
        assert_eq!(q.len(), 1);
        assert_eq!(q.total_bytes(), "x".len());
        assert_eq!(
            q.push_snapshot_replaced_or_coalesce("y".into(), 2, 9999),
            F03PushOutcome::Queued
        );
        assert_eq!(
            q.push_snapshot_replaced_or_coalesce("z".into(), 2, 9999),
            F03PushOutcome::CoalescedEscalated
        );

        let mut q2 = F03OutboundQueue::new();
        // Bytes: small budget, many events allowed — first line alone triggers byte cap
        let big = "0123456789"; // 10 bytes, max_b = 9
        assert_eq!(
            q2.push_snapshot_replaced_or_coalesce(big.into(), 100, 9),
            F03PushOutcome::CoalescedEscalated
        );
    }

    #[test]
    fn f03_mandatory_resync_never_silent_when_queue_full() {
        let mut q = F03OutboundQueue::new();
        let max_e = 1usize;
        let max_b = 1000usize;
        assert_eq!(
            q.push_snapshot_replaced_or_coalesce("only".into(), max_e, max_b),
            F03PushOutcome::Queued
        );
        let o = q.push_mandatory_resync(LIVE_WS_REASON_POLL_FAILED, max_e, max_b);
        assert_eq!(o, F03PushOutcome::CoalescedEscalated);
        assert_eq!(q.len(), 1);
        assert!(q.test_queued_line_strings()[0].contains("session_resync_required"));
    }

    #[test]
    fn live_ws_reasons_distinct_from_bounded_http_tokens() {
        assert!(!LIVE_WS_REASON_QUEUE_OVERFLOW.contains("bounded_truncation"));
        assert!(!crate::resync::RESYNC_HINT_REASON_BOUNDED_TRUNCATION.is_empty());
    }

    #[test]
    fn live_ws_reason_strings_never_equal_bounded_resync_hint_tokens() {
        let bounded = [
            crate::resync::RESYNC_HINT_REASON_BOUNDED_TRUNCATION,
            crate::resync::RESYNC_HINT_REASON_PER_RPC_POLL_NOT_INCREMENTAL,
            crate::resync::RESYNC_HINT_REASON_RETAINED_TAIL_REPLACES,
        ];
        let live = [
            LIVE_WS_REASON_QUEUE_OVERFLOW,
            LIVE_WS_REASON_POLL_FAILED,
            LIVE_WS_REASON_RESYNC_AFTER_WS_OVERLOAD,
            LIVE_WS_REASON_CONTINUITY_LOST_FINGERPRINT_GAP,
        ];
        for b in bounded {
            for l in live {
                assert_ne!(
                    b, l,
                    "LIVE_WS_REASON must never collide with frozen HTTP resync_hint.reason token"
                );
            }
        }
    }

    #[test]
    fn live_ws_reason_strings_are_pairwise_distinct() {
        let live = [
            LIVE_WS_REASON_QUEUE_OVERFLOW,
            LIVE_WS_REASON_POLL_FAILED,
            LIVE_WS_REASON_RESYNC_AFTER_WS_OVERLOAD,
            LIVE_WS_REASON_CONTINUITY_LOST_FINGERPRINT_GAP,
        ];
        for i in 0..live.len() {
            for j in i + 1..live.len() {
                assert_ne!(live[i], live[j]);
            }
        }
    }

    #[test]
    fn parse_v0_off_n_detects_regression() {
        assert_eq!(parse_v0_off_n("v0:off:3"), Some(3));
        assert_eq!(parse_v0_off_n("v0:empty"), None);
        assert!(fingerprint_looks_like_discontinuity(
            &SnapshotFingerprint {
                snapshot_cursor: "v0:off:5".into(),
                event_len: 0,
                returned_events: 0,
                retained_snapshot_unix_ms: None,
                snapshot_origin: "".into(),
            },
            &SnapshotFingerprint {
                snapshot_cursor: "v0:off:2".into(),
                event_len: 0,
                returned_events: 0,
                retained_snapshot_unix_ms: None,
                snapshot_origin: "".into(),
            }
        ));
    }
}

//! **Provisional** F-IPC over **TCP loopback** (dev / CI skeleton). **Not** the final transport (F-IPC
//! remains open for Unix socket + peer credentials). One JSON object per line (NDJSON), UTF-8.

use std::collections::HashMap;
use std::io::{self, BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::ipc::{
    validate_ipc_auth_version, FipcBoundedSnapshotMeta, FipcBridgeToCollector,
    FipcCollectorToBridge, FipcLiveDeltaTailV0, FIPC_LIVE_DELTA_CONTINUITY_APPEND_TAIL_V0,
    FIPC_LIVE_DELTA_CONTINUITY_UNSUPPORTED_ORIGIN_V0,
    FIPC_LIVE_DELTA_CONTINUITY_WITHHELD_REVISION_V0, FIPC_SNAPSHOT_ORIGIN_COLLECTOR_STORE,
    FIPC_SNAPSHOT_ORIGIN_PER_RPC_FILE_LANE, FIPC_SNAPSHOT_ORIGIN_PER_RPC_PROCFS,
    FIPC_SNAPSHOT_ORIGIN_UNKNOWN_OR_EMPTY, PROVISIONAL_FIPC_MAX_DELTA_EVENTS,
    PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS, PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
    PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
};

/// Matches `session_engine` / viewer F-07-style bound per line (honest cap for one NDJSON line).
const PROVISIONAL_FIPC_MAX_LINE_BYTES: usize = 4 * 1024 * 1024;

/// Last successful **retained** poll time (`0` = never) for procfs or file-lane background loops.
/// Lives here to avoid module cycles with retained loop crates.
#[derive(Debug)]
pub struct RetainedPollMeta {
    pub session_id: String,
    pub last_ok_unix_ms: AtomicU64,
}

impl RetainedPollMeta {
    pub fn new(session_id: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            last_ok_unix_ms: AtomicU64::new(0),
        }
    }
}

pub fn unix_epoch_millis_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Runtime for one F-IPC TCP connection: optional per-RPC snapshot feeds + in-memory store.
#[derive(Debug, Clone)]
pub struct IpcDevTcpRuntime {
    pub store: Arc<SnapshotStore>,
    /// When `Some` and the snapshot request `session_id` matches, serve from
    /// [`crate::procfs_ipc_feed::ProcfsSnapshotFeedConfig::poll_normalized_json`] (per RPC).
    pub procfs_feed: Option<crate::procfs_ipc_feed::ProcfsSnapshotFeedConfig>,
    /// When `Some` and the request `session_id` matches, serve from
    /// [`crate::file_lane_ipc_feed::FileLaneSnapshotFeedConfig::poll_normalized_json`] (per RPC).
    /// Checked **after** `procfs_feed` — use a **distinct** `session_id` from procfs feeds.
    pub file_lane_feed: Option<crate::file_lane_ipc_feed::FileLaneSnapshotFeedConfig>,
    /// When `Some` and the request `session_id` matches, F-IPC may include
    /// `retained_snapshot_unix_ms` from the last successful **procfs** retained poll (see `procfs_retained_loop`).
    pub retained_poll_meta: Option<Arc<RetainedPollMeta>>,
    /// When `Some` and the request `session_id` matches, same `retained_snapshot_unix_ms` hint for **file-lane** retained loop (`file_lane_retained_loop`).
    pub file_lane_retained_poll_meta: Option<Arc<RetainedPollMeta>>,
}

#[derive(Debug, Clone)]
struct SessionState {
    events: Vec<serde_json::Value>,
    /// Increments on [`SnapshotStore::set_session_events`] (replacement); **unchanged** on append-only.
    store_revision: u64,
}

/// In-memory session → normalized events as JSON (collector-owned; bridge never mutates).
#[derive(Debug, Default)]
pub struct SnapshotStore {
    inner: Mutex<HashMap<String, SessionState>>,
}

impl SnapshotStore {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    /// Replace timeline for a session (tests / retained loops). Bumps [`SessionState::store_revision`].
    pub fn set_session_events(
        &self,
        session_id: impl Into<String>,
        events: Vec<serde_json::Value>,
    ) {
        let mut g = self.inner.lock().expect("snapshot store poisoned");
        let sid = session_id.into();
        let next_rev = g
            .get(&sid)
            .map(|s| s.store_revision.saturating_add(1))
            .unwrap_or(1);
        g.insert(
            sid,
            SessionState {
                events,
                store_revision: next_rev,
            },
        );
    }

    /// Append-only tail (same revision). Used for honest live `session_delta` tails when the bounded prefix is stable.
    pub fn append_session_events(
        &self,
        session_id: impl Into<String>,
        extra: Vec<serde_json::Value>,
    ) {
        if extra.is_empty() {
            return;
        }
        let mut g = self.inner.lock().expect("snapshot store poisoned");
        let sid = session_id.into();
        let Some(st) = g.get_mut(&sid) else {
            return;
        };
        st.events.extend(extra);
    }

    /// Returns `(events, cursor, total_in_store, session_known, store_revision)`.
    /// - Unknown session → `v0:empty`, total `0`, `session_known == false`, revision `0`.
    /// - Known session with events → `v0:off:N` prefix, total `ev.len()`, `true`, current revision.
    /// - Known session with empty vec → `v0:off:0`, total `0`, `true`, current revision.
    pub(crate) fn get_bounded(
        &self,
        session_id: &str,
        max: usize,
    ) -> (Vec<serde_json::Value>, String, usize, bool, u64) {
        let g = self.inner.lock().expect("snapshot store poisoned");
        let Some(st) = g.get(session_id) else {
            return (Vec::new(), "v0:empty".to_string(), 0, false, 0);
        };
        let rev = st.store_revision;
        let ev = &st.events;
        let total = ev.len();
        if total == 0 {
            return (Vec::new(), "v0:off:0".to_string(), 0, true, rev);
        }
        let n = max.min(total);
        let slice: Vec<serde_json::Value> = ev.iter().take(n).cloned().collect();
        let cursor = format!("v0:off:{n}");
        (slice, cursor, total, true, rev)
    }

    /// Append-only tail for `session_delta` when `base_store_revision` matches and `after_available_exclusive` is in range.
    pub(crate) fn try_live_delta_tail_v0(
        &self,
        session_id: &str,
        tail: &FipcLiveDeltaTailV0,
    ) -> (Option<Vec<serde_json::Value>>, Option<String>) {
        let g = self.inner.lock().expect("snapshot store poisoned");
        let Some(st) = g.get(session_id) else {
            return (None, None);
        };
        if tail.base_store_revision != st.store_revision {
            return (
                None,
                Some(FIPC_LIVE_DELTA_CONTINUITY_WITHHELD_REVISION_V0.to_string()),
            );
        }
        let total = st.events.len();
        let after = tail.after_available_exclusive as usize;
        if after > total {
            return (
                Some(Vec::new()),
                Some(FIPC_LIVE_DELTA_CONTINUITY_APPEND_TAIL_V0.to_string()),
            );
        }
        if after == total {
            return (
                Some(Vec::new()),
                Some(FIPC_LIVE_DELTA_CONTINUITY_APPEND_TAIL_V0.to_string()),
            );
        }
        let slice: Vec<serde_json::Value> = st
            .events
            .iter()
            .skip(after)
            .take(PROVISIONAL_FIPC_MAX_DELTA_EVENTS)
            .cloned()
            .collect();
        (
            Some(slice),
            Some(FIPC_LIVE_DELTA_CONTINUITY_APPEND_TAIL_V0.to_string()),
        )
    }
}

#[cfg(test)]
mod snapshot_store_contract_tests {
    use super::SnapshotStore;

    #[test]
    fn unknown_session_uses_v0_empty_and_not_known() {
        let s = SnapshotStore::new();
        let (ev, cur, total, known, rev) = s.get_bounded("missing", 10);
        assert!(ev.is_empty());
        assert_eq!(cur, "v0:empty");
        assert_eq!(total, 0);
        assert!(!known);
        assert_eq!(rev, 0);
    }

    #[test]
    fn known_empty_session_uses_v0_off_zero() {
        let s = SnapshotStore::new();
        s.set_session_events("empty_sess", Vec::new());
        let (ev, cur, total, known, _rev) = s.get_bounded("empty_sess", 10);
        assert!(ev.is_empty());
        assert_eq!(cur, "v0:off:0");
        assert_eq!(total, 0);
        assert!(known);
    }

    #[test]
    fn known_populated_prefix_cursor_and_totals() {
        let s = SnapshotStore::new();
        s.set_session_events(
            "pop",
            vec![serde_json::json!({"k": 1}), serde_json::json!({"k": 2})],
        );
        let (ev, cur, total, known, _rev) = s.get_bounded("pop", 1);
        assert_eq!(ev.len(), 1);
        assert_eq!(cur, "v0:off:1");
        assert_eq!(total, 2);
        assert!(known);
    }

    #[test]
    fn append_preserves_revision_tail_returns_new_events() {
        use crate::ipc::{FipcLiveDeltaTailV0, FIPC_LIVE_DELTA_CONTINUITY_APPEND_TAIL_V0};

        let s = SnapshotStore::new();
        let bulk: Vec<_> = (0..257).map(|i| serde_json::json!({"i": i})).collect();
        s.set_session_events("t", bulk);
        let (_, _, total, _, rev) = s.get_bounded("t", 256);
        assert_eq!(total, 257);
        s.append_session_events("t", vec![serde_json::json!({"i": 999})]);
        let tail = FipcLiveDeltaTailV0 {
            after_available_exclusive: 257,
            base_store_revision: rev,
        };
        let (ev, c) = s.try_live_delta_tail_v0("t", &tail);
        assert_eq!(
            c.as_deref(),
            Some(FIPC_LIVE_DELTA_CONTINUITY_APPEND_TAIL_V0)
        );
        assert_eq!(ev.as_ref().map(|v| v.len()), Some(1));
    }
}

/// Configuration for [`run_ipc_dev_tcp_listener`].
#[derive(Debug, Clone)]
pub struct IpcDevTcpListenConfig {
    pub bind: std::net::SocketAddr,
    pub shared_secret: Arc<str>,
}

fn read_ndjson_line(reader: &mut impl BufRead) -> io::Result<String> {
    let mut line = String::new();
    let n = reader.read_line(&mut line)?;
    if n == 0 {
        return Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            "fipc: unexpected EOF before line",
        ));
    }
    if line.len() > PROVISIONAL_FIPC_MAX_LINE_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "fipc: line exceeds maximum length",
        ));
    }
    Ok(line.trim_end_matches(['\r', '\n']).to_string())
}

fn write_ndjson_line(mut w: impl Write, v: &impl serde::Serialize) -> io::Result<()> {
    let s = serde_json::to_string(v).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;
    writeln!(w, "{s}")?;
    w.flush()?;
    Ok(())
}

/// Handle one TCP connection (blocking): handshake then snapshot RPC loop until EOF.
pub fn handle_ipc_dev_tcp_connection(
    stream: TcpStream,
    shared_secret: &str,
    runtime: &IpcDevTcpRuntime,
) -> io::Result<()> {
    let mut reader = BufReader::new(stream.try_clone()?);
    let mut writer = stream;

    let first = read_ndjson_line(&mut reader)?;
    let msg: FipcBridgeToCollector = serde_json::from_str(&first).map_err(|e| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("fipc: invalid first message: {e}"),
        )
    })?;

    let FipcBridgeToCollector::Hello {
        wire_protocol_version,
        auth_token_version,
        shared_secret: secret,
    } = msg
    else {
        write_ndjson_line(
            &mut writer,
            &FipcCollectorToBridge::HelloReject {
                code: "handshake_required".to_string(),
                message: "first message must be Hello".to_string(),
            },
        )?;
        return Ok(());
    };

    if wire_protocol_version != PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION {
        write_ndjson_line(
            &mut writer,
            &FipcCollectorToBridge::HelloReject {
                code: "wire_protocol_mismatch".to_string(),
                message: format!(
                    "expected wire_protocol_version {}, got {wire_protocol_version}",
                    PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION
                ),
            },
        )?;
        return Ok(());
    }

    if validate_ipc_auth_version(auth_token_version).is_err() {
        write_ndjson_line(
            &mut writer,
            &FipcCollectorToBridge::HelloReject {
                code: "auth_token_version_mismatch".to_string(),
                message: format!(
                    "expected auth_token_version {PROVISIONAL_IPC_AUTH_TOKEN_VERSION}, got {auth_token_version}"
                ),
            },
        )?;
        return Ok(());
    }

    if secret != shared_secret {
        write_ndjson_line(
            &mut writer,
            &FipcCollectorToBridge::HelloReject {
                code: "shared_secret_mismatch".to_string(),
                message: "F-IPC shared secret does not match".to_string(),
            },
        )?;
        return Ok(());
    }

    write_ndjson_line(
        &mut writer,
        &FipcCollectorToBridge::HelloAck {
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
        },
    )?;

    loop {
        let line = match read_ndjson_line(&mut reader) {
            Ok(l) => l,
            Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => break,
            Err(e) => return Err(e),
        };
        if line.is_empty() {
            continue;
        }
        let req: FipcBridgeToCollector = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(_) => {
                // Fail closed: do not fabricate snapshot data after a garbled line.
                break;
            }
        };

        match req {
            FipcBridgeToCollector::Hello { .. } => {
                write_ndjson_line(
                    &mut writer,
                    &FipcCollectorToBridge::HelloReject {
                        code: "duplicate_hello".to_string(),
                        message: "Hello already completed".to_string(),
                    },
                )?;
            }
            FipcBridgeToCollector::BoundedSnapshotRequest {
                session_id,
                cursor: _,
                max_events,
                live_delta_tail_v0,
            } => {
                let cap = (max_events as usize).min(PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS);
                let (
                    events,
                    snapshot_cursor,
                    retained_snapshot_unix_ms,
                    snapshot_meta,
                    live_delta_events,
                    live_delta_continuity_v0,
                ) = bounded_snapshot_events(runtime, &session_id, cap, live_delta_tail_v0.as_ref());
                write_ndjson_line(
                    &mut writer,
                    &FipcCollectorToBridge::BoundedSnapshotReply {
                        session_id,
                        snapshot_cursor,
                        events,
                        live_session_ingest: false,
                        retained_snapshot_unix_ms,
                        snapshot_meta: Some(snapshot_meta),
                        live_delta_events,
                        live_delta_continuity_v0,
                    },
                )?;
            }
        }
    }

    Ok(())
}

fn retained_timestamp_for_session(runtime: &IpcDevTcpRuntime, session_id: &str) -> Option<u64> {
    for meta_opt in [
        runtime.retained_poll_meta.as_ref(),
        runtime.file_lane_retained_poll_meta.as_ref(),
    ] {
        let Some(meta) = meta_opt else {
            continue;
        };
        if meta.session_id != session_id {
            continue;
        }
        let ms = meta.last_ok_unix_ms.load(Ordering::Relaxed);
        if ms > 0 {
            return Some(ms);
        }
    }
    None
}

type BoundedSnapshotRpcResult = (
    Vec<serde_json::Value>,
    String,
    Option<u64>,
    FipcBoundedSnapshotMeta,
    Option<Vec<serde_json::Value>>,
    Option<String>,
);

fn bounded_snapshot_events(
    runtime: &IpcDevTcpRuntime,
    session_id: &str,
    cap: usize,
    live_delta_tail: Option<&crate::ipc::FipcLiveDeltaTailV0>,
) -> BoundedSnapshotRpcResult {
    let tail_requested = live_delta_tail.is_some();
    let note_unsupported_tail = |meta: FipcBoundedSnapshotMeta| {
        let (ld_e, ld_c) = if tail_requested {
            (
                None,
                Some(FIPC_LIVE_DELTA_CONTINUITY_UNSUPPORTED_ORIGIN_V0.to_string()),
            )
        } else {
            (None, None)
        };
        (meta, ld_e, ld_c)
    };

    if let Some(ref feed) = runtime.procfs_feed {
        if session_id == feed.session_id {
            return match feed.poll_normalized_json() {
                Ok(full) => {
                    let total = full.len();
                    if total == 0 {
                        let (meta, ld_e, ld_c) = note_unsupported_tail(FipcBoundedSnapshotMeta {
                            snapshot_origin: FIPC_SNAPSHOT_ORIGIN_PER_RPC_PROCFS.to_string(),
                            returned_events: 0,
                            available_in_view: 0,
                            truncated_by_max_events: false,
                            store_revision: None,
                        });
                        (Vec::new(), "v0:empty".to_string(), None, meta, ld_e, ld_c)
                    } else {
                        let n = cap.min(total);
                        let slice: Vec<serde_json::Value> = full.iter().take(n).cloned().collect();
                        let (meta, ld_e, ld_c) = note_unsupported_tail(FipcBoundedSnapshotMeta {
                            snapshot_origin: FIPC_SNAPSHOT_ORIGIN_PER_RPC_PROCFS.to_string(),
                            returned_events: n as u32,
                            available_in_view: total as u32,
                            truncated_by_max_events: total > n,
                            store_revision: None,
                        });
                        (slice, format!("v0:off:{n}"), None, meta, ld_e, ld_c)
                    }
                }
                Err(e) => {
                    eprintln!("ipc-serve: procfs snapshot poll/ingest failed: {e}");
                    let (meta, ld_e, ld_c) = note_unsupported_tail(FipcBoundedSnapshotMeta {
                        snapshot_origin: FIPC_SNAPSHOT_ORIGIN_PER_RPC_PROCFS.to_string(),
                        returned_events: 0,
                        available_in_view: 0,
                        truncated_by_max_events: false,
                        store_revision: None,
                    });
                    (Vec::new(), "v0:empty".to_string(), None, meta, ld_e, ld_c)
                }
            };
        }
    }
    if let Some(ref feed) = runtime.file_lane_feed {
        if session_id == feed.session_id {
            return match feed.poll_normalized_json() {
                Ok(full) => {
                    let total = full.len();
                    if total == 0 {
                        let (meta, ld_e, ld_c) = note_unsupported_tail(FipcBoundedSnapshotMeta {
                            snapshot_origin: FIPC_SNAPSHOT_ORIGIN_PER_RPC_FILE_LANE.to_string(),
                            returned_events: 0,
                            available_in_view: 0,
                            truncated_by_max_events: false,
                            store_revision: None,
                        });
                        (Vec::new(), "v0:empty".to_string(), None, meta, ld_e, ld_c)
                    } else {
                        let n = cap.min(total);
                        let slice: Vec<serde_json::Value> = full.iter().take(n).cloned().collect();
                        let (meta, ld_e, ld_c) = note_unsupported_tail(FipcBoundedSnapshotMeta {
                            snapshot_origin: FIPC_SNAPSHOT_ORIGIN_PER_RPC_FILE_LANE.to_string(),
                            returned_events: n as u32,
                            available_in_view: total as u32,
                            truncated_by_max_events: total > n,
                            store_revision: None,
                        });
                        (slice, format!("v0:off:{n}"), None, meta, ld_e, ld_c)
                    }
                }
                Err(e) => {
                    eprintln!("ipc-serve: file-lane snapshot poll/ingest failed: {e}");
                    let (meta, ld_e, ld_c) = note_unsupported_tail(FipcBoundedSnapshotMeta {
                        snapshot_origin: FIPC_SNAPSHOT_ORIGIN_PER_RPC_FILE_LANE.to_string(),
                        returned_events: 0,
                        available_in_view: 0,
                        truncated_by_max_events: false,
                        store_revision: None,
                    });
                    (Vec::new(), "v0:empty".to_string(), None, meta, ld_e, ld_c)
                }
            };
        }
    }
    let (events, cursor, total, session_known, store_revision) =
        runtime.store.get_bounded(session_id, cap);
    let retained = retained_timestamp_for_session(runtime, session_id);
    let n = events.len();
    let meta = if !session_known {
        FipcBoundedSnapshotMeta {
            snapshot_origin: FIPC_SNAPSHOT_ORIGIN_UNKNOWN_OR_EMPTY.to_string(),
            returned_events: 0,
            available_in_view: 0,
            truncated_by_max_events: false,
            store_revision: None,
        }
    } else {
        FipcBoundedSnapshotMeta {
            snapshot_origin: FIPC_SNAPSHOT_ORIGIN_COLLECTOR_STORE.to_string(),
            returned_events: n as u32,
            available_in_view: total as u32,
            truncated_by_max_events: total > n,
            store_revision: Some(store_revision),
        }
    };

    let (live_delta_events, live_delta_continuity_v0) = if session_known {
        if let Some(tail) = live_delta_tail {
            runtime.store.try_live_delta_tail_v0(session_id, tail)
        } else {
            (None, None)
        }
    } else if tail_requested {
        (
            None,
            Some(FIPC_LIVE_DELTA_CONTINUITY_UNSUPPORTED_ORIGIN_V0.to_string()),
        )
    } else {
        (None, None)
    };

    (
        events,
        cursor,
        retained,
        meta,
        live_delta_events,
        live_delta_continuity_v0,
    )
}

/// Bind `config.bind` and accept connections until error. Each connection is handled on a new thread.
pub fn run_ipc_dev_tcp_listener(
    config: IpcDevTcpListenConfig,
    runtime: Arc<IpcDevTcpRuntime>,
) -> io::Result<()> {
    let listener = TcpListener::bind(config.bind)?;
    loop {
        let (stream, _) = listener.accept()?;
        let secret = config.shared_secret.clone();
        let rt = runtime.clone();
        std::thread::spawn(move || {
            let _ = handle_ipc_dev_tcp_connection(stream, secret.as_ref(), rt.as_ref());
        });
    }
}

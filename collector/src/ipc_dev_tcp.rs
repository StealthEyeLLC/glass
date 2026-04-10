//! **Provisional** F-IPC over **TCP loopback** (dev / CI skeleton). **Not** the final transport (F-IPC
//! remains open for Unix socket + peer credentials). One JSON object per line (NDJSON), UTF-8.

use std::collections::HashMap;
use std::io::{self, BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};

use crate::ipc::{
    validate_ipc_auth_version, FipcBridgeToCollector, FipcCollectorToBridge,
    PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS, PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
    PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
};

/// Matches `session_engine` / viewer F-07-style bound per line (honest cap for one NDJSON line).
const PROVISIONAL_FIPC_MAX_LINE_BYTES: usize = 4 * 1024 * 1024;

/// In-memory session → normalized events as JSON (collector-owned; bridge never mutates).
#[derive(Debug, Default)]
pub struct SnapshotStore {
    inner: Mutex<HashMap<String, Vec<serde_json::Value>>>,
}

impl SnapshotStore {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    /// Replace timeline for a session (tests / future ingest hook).
    pub fn set_session_events(
        &self,
        session_id: impl Into<String>,
        events: Vec<serde_json::Value>,
    ) {
        let mut g = self.inner.lock().expect("snapshot store poisoned");
        g.insert(session_id.into(), events);
    }

    fn get_bounded(&self, session_id: &str, max: usize) -> (Vec<serde_json::Value>, String) {
        let g = self.inner.lock().expect("snapshot store poisoned");
        let Some(ev) = g.get(session_id) else {
            return (Vec::new(), "v0:empty".to_string());
        };
        let n = max.min(ev.len());
        let slice: Vec<serde_json::Value> = ev.iter().take(n).cloned().collect();
        let cursor = format!("v0:off:{n}");
        (slice, cursor)
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
    store: &SnapshotStore,
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
            } => {
                let cap = (max_events as usize).min(PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS);
                let (events, snapshot_cursor) = store.get_bounded(&session_id, cap);
                write_ndjson_line(
                    &mut writer,
                    &FipcCollectorToBridge::BoundedSnapshotReply {
                        session_id,
                        snapshot_cursor,
                        events,
                        live_session_ingest: false,
                    },
                )?;
            }
        }
    }

    Ok(())
}

/// Bind `config.bind` and accept connections until error. Each connection is handled on a new thread.
pub fn run_ipc_dev_tcp_listener(
    config: IpcDevTcpListenConfig,
    store: Arc<SnapshotStore>,
) -> io::Result<()> {
    let listener = TcpListener::bind(config.bind)?;
    loop {
        let (stream, _) = listener.accept()?;
        let secret = config.shared_secret.clone();
        let st = store.clone();
        std::thread::spawn(move || {
            let _ = handle_ipc_dev_tcp_connection(stream, secret.as_ref(), st.as_ref());
        });
    }
}

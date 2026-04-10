//! Provisional F-IPC **client** (bridge → collector TCP). See `glass_collector::ipc_dev_tcp`.
//!
//! Exposed as `pub` so integration tests and tooling can perform snapshot RPCs; the HTTP snapshot route
//! remains the primary stable API for viewers.
//!
//! **Timeouts:** one **provisional** per-RPC deadline (`CollectorIpcClientConfig::timeout`) covers TCP
//! connect, handshake, and snapshot read/write. Phase labels identify which step exceeded the budget.

use std::io::ErrorKind;

use glass_collector::ipc::{
    FipcBridgeToCollector, FipcCollectorToBridge, FipcLiveDeltaTailV0,
    PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS, PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
    PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
use tokio::time::Instant;

/// **Provisional** — upper bound for the TCP connect attempt within [`fetch_bounded_snapshot`]. The
/// overall RPC still respects `timeout` (deadline); this only caps connect so a dead host does not
/// consume the entire budget before handshake I/O.
pub const PROVISIONAL_FIPC_CONNECT_ATTEMPT_MAX: std::time::Duration =
    std::time::Duration::from_secs(2);

#[derive(Debug, thiserror::Error)]
pub enum FipcClientError {
    /// F-IPC RPC exceeded `CollectorIpcClientConfig::timeout` (deadline) during this phase.
    #[error("F-IPC RPC timed out during {phase}")]
    Timeout { phase: &'static str },
    /// Nothing listening (typical local demo: collector not started).
    #[error("collector unreachable: connection refused")]
    ConnectionRefused,
    /// TCP or I/O error on the provisional link (`phase` locates the step).
    #[error("F-IPC I/O during {phase}: {source}")]
    Io {
        phase: &'static str,
        source: std::io::Error,
    },
    /// Collector returned [`FipcCollectorToBridge::HelloReject`] (handshake or mid-stream reject line).
    #[error("handshake rejected: {code} — {message}")]
    HandshakeRejected { code: String, message: String },
    /// EOF or unparsable JSON where a collector reply was required.
    #[error("invalid F-IPC response during {phase}: {detail}")]
    MalformedResponse { phase: &'static str, detail: String },
    #[error("unexpected collector message: {0:?}")]
    Unexpected(Box<FipcCollectorToBridge>),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
}

impl FipcClientError {
    /// Stable machine key for HTTP 503 JSON (`error` field) and operator tooling. **Not** a frozen contract.
    pub fn bridge_error_code(&self) -> &'static str {
        match self {
            FipcClientError::Timeout { .. } => "collector_ipc_timeout",
            FipcClientError::ConnectionRefused => "collector_ipc_connection_refused",
            FipcClientError::Io { source, .. } if source.kind() == ErrorKind::TimedOut => {
                "collector_ipc_timeout"
            }
            FipcClientError::Io { .. } => "collector_ipc_io_error",
            FipcClientError::HandshakeRejected { code, .. } => match code.as_str() {
                "shared_secret_mismatch" => "collector_ipc_auth_mismatch",
                "wire_protocol_mismatch" | "auth_token_version_mismatch" => {
                    "collector_ipc_protocol_mismatch"
                }
                "invalid_request_line" | "duplicate_hello" => "collector_ipc_request_invalid",
                _ => "collector_ipc_handshake_rejected",
            },
            FipcClientError::MalformedResponse { .. } => "collector_ipc_malformed_response",
            FipcClientError::Unexpected(_) => "collector_ipc_unexpected_reply",
            FipcClientError::Json(_) => "collector_ipc_malformed_response",
        }
    }

    /// Optional sub-code when [`Self::bridge_error_code`] is `collector_ipc_handshake_rejected` or auth/protocol variants need detail.
    pub fn handshake_code(&self) -> Option<&str> {
        match self {
            FipcClientError::HandshakeRejected { code, .. } => Some(code.as_str()),
            _ => None,
        }
    }

    /// Phase string when timeout or I/O variant carries it (for JSON `fipc_phase`).
    pub fn phase(&self) -> Option<&'static str> {
        match self {
            FipcClientError::Timeout { phase } => Some(*phase),
            FipcClientError::Io { phase, .. } => Some(*phase),
            FipcClientError::MalformedResponse { phase, .. } => Some(*phase),
            _ => None,
        }
    }
}

/// Perform Hello + one `BoundedSnapshotRequest`, returning the reply variant on success.
pub async fn fetch_bounded_snapshot(
    addr: std::net::SocketAddr,
    shared_secret: &str,
    session_id: &str,
    cursor: Option<&str>,
    max_events: u32,
    timeout: std::time::Duration,
    live_delta_tail_v0: Option<FipcLiveDeltaTailV0>,
) -> Result<FipcCollectorToBridge, FipcClientError> {
    let deadline = Instant::now() + timeout;
    fetch_bounded_snapshot_deadline(
        addr,
        shared_secret,
        session_id,
        cursor,
        max_events,
        deadline,
        live_delta_tail_v0,
    )
    .await
}

async fn fetch_bounded_snapshot_deadline(
    addr: std::net::SocketAddr,
    shared_secret: &str,
    session_id: &str,
    cursor: Option<&str>,
    max_events: u32,
    deadline: Instant,
    live_delta_tail_v0: Option<FipcLiveDeltaTailV0>,
) -> Result<FipcCollectorToBridge, FipcClientError> {
    let now = Instant::now();
    // Connect attempt is capped so a misconfigured host cannot burn the entire RPC budget before I/O.
    let connect_deadline = deadline.min(now + PROVISIONAL_FIPC_CONNECT_ATTEMPT_MAX);

    let stream = match tokio::time::timeout_at(connect_deadline, TcpStream::connect(addr)).await {
        Err(_) => {
            return Err(FipcClientError::Timeout {
                phase: "tcp_connect",
            });
        }
        Ok(Err(e)) => {
            return Err(map_connect_error(e));
        }
        Ok(Ok(s)) => s,
    };

    let (read_half, mut write_half) = stream.into_split();
    let mut reader = BufReader::new(read_half);

    let hello = FipcBridgeToCollector::Hello {
        wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
        auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
        shared_secret: shared_secret.to_string(),
    };
    let line = serde_json::to_string(&hello)? + "\n";
    tokio::time::timeout_at(deadline, write_half.write_all(line.as_bytes()))
        .await
        .map_err(|_| FipcClientError::Timeout {
            phase: "fipc_write_hello",
        })?
        .map_err(|e| FipcClientError::Io {
            phase: "fipc_write_hello",
            source: e,
        })?;
    tokio::time::timeout_at(deadline, write_half.flush())
        .await
        .map_err(|_| FipcClientError::Timeout {
            phase: "fipc_flush_hello",
        })?
        .map_err(|e| FipcClientError::Io {
            phase: "fipc_flush_hello",
            source: e,
        })?;

    let mut buf = String::new();
    let n = tokio::time::timeout_at(deadline, reader.read_line(&mut buf))
        .await
        .map_err(|_| FipcClientError::Timeout {
            phase: "fipc_read_handshake_line",
        })?
        .map_err(|e| FipcClientError::Io {
            phase: "fipc_read_handshake_line",
            source: e,
        })?;
    if n == 0 {
        return Err(FipcClientError::MalformedResponse {
            phase: "fipc_read_handshake_line",
            detail: "unexpected EOF before handshake line".into(),
        });
    }
    let ack: FipcCollectorToBridge =
        serde_json::from_str(buf.trim_end()).map_err(|e| FipcClientError::MalformedResponse {
            phase: "fipc_handshake_json",
            detail: e.to_string(),
        })?;
    match ack {
        FipcCollectorToBridge::HelloReject { code, message } => {
            return Err(FipcClientError::HandshakeRejected { code, message });
        }
        FipcCollectorToBridge::HelloAck { .. } => {}
        other => {
            return Err(FipcClientError::Unexpected(Box::new(other)));
        }
    }

    let cap = max_events
        .max(1)
        .min(PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS as u32);
    let req = FipcBridgeToCollector::BoundedSnapshotRequest {
        session_id: session_id.to_string(),
        cursor: cursor.map(|s| s.to_string()),
        max_events: cap,
        live_delta_tail_v0,
    };
    let req_line = serde_json::to_string(&req)? + "\n";
    tokio::time::timeout_at(deadline, write_half.write_all(req_line.as_bytes()))
        .await
        .map_err(|_| FipcClientError::Timeout {
            phase: "fipc_write_snapshot_request",
        })?
        .map_err(|e| FipcClientError::Io {
            phase: "fipc_write_snapshot_request",
            source: e,
        })?;
    tokio::time::timeout_at(deadline, write_half.flush())
        .await
        .map_err(|_| FipcClientError::Timeout {
            phase: "fipc_flush_snapshot_request",
        })?
        .map_err(|e| FipcClientError::Io {
            phase: "fipc_flush_snapshot_request",
            source: e,
        })?;

    buf.clear();
    let n = tokio::time::timeout_at(deadline, reader.read_line(&mut buf))
        .await
        .map_err(|_| FipcClientError::Timeout {
            phase: "fipc_read_snapshot_line",
        })?
        .map_err(|e| FipcClientError::Io {
            phase: "fipc_read_snapshot_line",
            source: e,
        })?;
    if n == 0 {
        return Err(FipcClientError::MalformedResponse {
            phase: "fipc_read_snapshot_line",
            detail: "unexpected EOF before snapshot reply line".into(),
        });
    }
    let reply: FipcCollectorToBridge =
        serde_json::from_str(buf.trim_end()).map_err(|e| FipcClientError::MalformedResponse {
            phase: "fipc_snapshot_reply_json",
            detail: e.to_string(),
        })?;
    match reply {
        FipcCollectorToBridge::BoundedSnapshotReply { .. } => Ok(reply),
        FipcCollectorToBridge::HelloReject { code, message } => {
            Err(FipcClientError::HandshakeRejected { code, message })
        }
        other => Err(FipcClientError::Unexpected(Box::new(other))),
    }
}

fn map_connect_error(e: std::io::Error) -> FipcClientError {
    if e.kind() == ErrorKind::ConnectionRefused {
        return FipcClientError::ConnectionRefused;
    }
    FipcClientError::Io {
        phase: "tcp_connect",
        source: e,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bridge_error_code_timeout() {
        let e = FipcClientError::Timeout {
            phase: "tcp_connect",
        };
        assert_eq!(e.bridge_error_code(), "collector_ipc_timeout");
    }

    #[test]
    fn bridge_error_code_auth() {
        let e = FipcClientError::HandshakeRejected {
            code: "shared_secret_mismatch".into(),
            message: "nope".into(),
        };
        assert_eq!(e.bridge_error_code(), "collector_ipc_auth_mismatch");
        assert_eq!(e.handshake_code(), Some("shared_secret_mismatch"));
    }

    #[test]
    fn bridge_error_code_protocol_wire() {
        let e = FipcClientError::HandshakeRejected {
            code: "wire_protocol_mismatch".into(),
            message: "x".into(),
        };
        assert_eq!(e.bridge_error_code(), "collector_ipc_protocol_mismatch");
    }
}

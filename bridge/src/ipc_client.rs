//! Provisional F-IPC **client** (bridge → collector TCP). See `glass_collector::ipc_dev_tcp`.
//!
//! Exposed as `pub` so integration tests and tooling can perform snapshot RPCs; the HTTP snapshot route
//! remains the primary stable API for viewers.

use std::time::Duration;

use glass_collector::ipc::{
    FipcBridgeToCollector, FipcCollectorToBridge, FipcLiveDeltaTailV0,
    PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS, PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
    PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

#[derive(Debug, thiserror::Error)]
pub enum FipcClientError {
    #[error("io: {0}")]
    Io(#[from] std::io::Error),
    #[error("rpc timeout")]
    Timeout,
    #[error("handshake rejected: {code} — {message}")]
    HandshakeRejected { code: String, message: String },
    #[error("unexpected collector message: {0:?}")]
    Unexpected(Box<FipcCollectorToBridge>),
    #[error("json: {0}")]
    Json(#[from] serde_json::Error),
}

/// Perform Hello + one `BoundedSnapshotRequest`, returning the reply variant on success.
pub async fn fetch_bounded_snapshot(
    addr: std::net::SocketAddr,
    shared_secret: &str,
    session_id: &str,
    cursor: Option<&str>,
    max_events: u32,
    timeout: Duration,
    live_delta_tail_v0: Option<FipcLiveDeltaTailV0>,
) -> Result<FipcCollectorToBridge, FipcClientError> {
    tokio::time::timeout(
        timeout,
        fetch_bounded_snapshot_inner(
            addr,
            shared_secret,
            session_id,
            cursor,
            max_events,
            live_delta_tail_v0,
        ),
    )
    .await
    .map_err(|_| FipcClientError::Timeout)?
}

async fn fetch_bounded_snapshot_inner(
    addr: std::net::SocketAddr,
    shared_secret: &str,
    session_id: &str,
    cursor: Option<&str>,
    max_events: u32,
    live_delta_tail_v0: Option<FipcLiveDeltaTailV0>,
) -> Result<FipcCollectorToBridge, FipcClientError> {
    let stream = TcpStream::connect(addr).await?;
    let (read_half, mut write_half) = stream.into_split();
    let mut reader = BufReader::new(read_half);

    let hello = FipcBridgeToCollector::Hello {
        wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
        auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
        shared_secret: shared_secret.to_string(),
    };
    let line = serde_json::to_string(&hello)? + "\n";
    write_half.write_all(line.as_bytes()).await?;
    write_half.flush().await?;

    let mut buf = String::new();
    reader.read_line(&mut buf).await?;
    let ack: FipcCollectorToBridge = serde_json::from_str(buf.trim_end())?;
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
    write_half.write_all(req_line.as_bytes()).await?;
    write_half.flush().await?;

    buf.clear();
    reader.read_line(&mut buf).await?;
    let reply: FipcCollectorToBridge = serde_json::from_str(buf.trim_end())?;
    match reply {
        FipcCollectorToBridge::BoundedSnapshotReply { .. } => Ok(reply),
        FipcCollectorToBridge::HelloReject { code, message } => {
            Err(FipcClientError::HandshakeRejected { code, message })
        }
        other => Err(FipcClientError::Unexpected(Box::new(other))),
    }
}

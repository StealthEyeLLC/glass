//! Skeleton **authenticated local IPC** contract (privileged collector → unprivileged bridge).
//! **No** socket implementation here — types only until Phase 0 transport freeze (see `docs/PRIVILEGE_SEPARATION.md`).

use serde::{Deserialize, Serialize};

use crate::capability::FidelityReport;
use crate::raw::RawObservation;

/// **Provisional** until human freeze on credential format (`PHASE0_FREEZE_TRACKER` / PRIVILEGE doc).
pub const PROVISIONAL_IPC_AUTH_TOKEN_VERSION: u32 = 0;

/// Handshake material (bridge challenges, collector proves possession of local secret — **TBD**).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct IpcAuthHandshake {
    pub token_version: u32,
    pub challenge_nonce_hex: String,
}

/// Classify IPC messages for routing in the bridge.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IpcMessageKind {
    Capability,
    RawBatch,
    Error,
    Heartbeat,
}

/// Payloads crossing the boundary (privileged side produces; bridge validates auth then forwards).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IpcPayload {
    Fidelity(FidelityReport),
    RawBatch { observations: Vec<RawObservation> },
    Heartbeat { uptime_ms: u64 },
}

/// Envelope: every message carries auth version for forward compatibility.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CollectorIpcMessage {
    pub auth_token_version: u32,
    pub kind: IpcMessageKind,
    pub payload: IpcPayload,
}

impl CollectorIpcMessage {
    pub fn fidelity(report: FidelityReport) -> Self {
        Self {
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            kind: IpcMessageKind::Capability,
            payload: IpcPayload::Fidelity(report),
        }
    }
}

/// Failure the bridge might surface if auth or schema fails.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CollectorIpcError {
    pub code: String,
    pub message: String,
}

impl CollectorIpcError {
    pub fn auth_failed() -> Self {
        Self {
            code: "ipc_auth_failed".to_string(),
            message: "local IPC authentication not completed (skeleton)".to_string(),
        }
    }
}

/// Validate envelope auth version — **skeleton**: only version 0 accepted.
pub fn validate_ipc_auth_version(version: u32) -> Result<(), CollectorIpcError> {
    if version != PROVISIONAL_IPC_AUTH_TOKEN_VERSION {
        return Err(CollectorIpcError {
            code: "ipc_auth_version_mismatch".to_string(),
            message: format!("expected {PROVISIONAL_IPC_AUTH_TOKEN_VERSION}, got {version}"),
        });
    }
    Ok(())
}

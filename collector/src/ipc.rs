//! Authenticated local IPC contract (privileged collector → unprivileged bridge).
//!
//! **Transport:** a **provisional** dev TCP listener is implemented in [`crate::ipc_dev_tcp`]; Unix
//! socket / peer-cred auth remain human-owned (F-IPC). Wire messages below are **versioned** and
//! **fail closed** on mismatch.

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

// --- F-IPC provisional wire (NDJSON lines over TCP in `ipc_dev_tcp`) -----------------------------

/// Wire protocol version for [`FipcBridgeToCollector`] / [`FipcCollectorToBridge`] (distinct from [`PROVISIONAL_IPC_AUTH_TOKEN_VERSION`]).
pub const PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION: u32 = 1;

/// Upper bound on events returned per [`FipcBridgeToCollector::BoundedSnapshotRequest`].
pub const PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS: usize = 256;

/// Upper bound on optional `live_delta_events` tail per bounded reply (`collector_store` append-only path).
pub const PROVISIONAL_FIPC_MAX_DELTA_EVENTS: usize = 64;

/// Hard cap on normalized events kept per session in [`crate::ipc_dev_tcp::SnapshotStore`] (retained loops).
pub const PROVISIONAL_MAX_RETAINED_SNAPSHOT_EVENTS: usize = 2048;

/// [`BoundedSnapshotReply::live_delta_continuity_v0`] — tail matches append-only continuity.
pub const FIPC_LIVE_DELTA_CONTINUITY_APPEND_TAIL_V0: &str = "append_only_tail_v0";
/// Client `base_store_revision` is stale (store was replaced since watermark).
pub const FIPC_LIVE_DELTA_CONTINUITY_WITHHELD_REVISION_V0: &str =
    "withheld_store_replaced_since_mark_v0";
/// Tail requests are not implemented for this snapshot origin (per-RPC feeds).
pub const FIPC_LIVE_DELTA_CONTINUITY_UNSUPPORTED_ORIGIN_V0: &str = "unsupported_snapshot_origin_v0";

/// [`FipcBoundedSnapshotMeta::snapshot_origin`] — unknown session / empty collector view.
pub const FIPC_SNAPSHOT_ORIGIN_UNKNOWN_OR_EMPTY: &str = "unknown_or_empty";
/// In-memory [`crate::ipc_dev_tcp::SnapshotStore`] (seeded sessions or retained tail).
pub const FIPC_SNAPSHOT_ORIGIN_COLLECTOR_STORE: &str = "collector_store";
/// Per-request procfs poll on `ipc-serve` (`--procfs-session`).
pub const FIPC_SNAPSHOT_ORIGIN_PER_RPC_PROCFS: &str = "per_rpc_procfs";
/// Per-request file-lane poll (`--file-lane-session`).
pub const FIPC_SNAPSHOT_ORIGIN_PER_RPC_FILE_LANE: &str = "per_rpc_file_lane";

/// Honest bounded-snapshot metadata for bridge / operator (not a live-stream cursor contract).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FipcBoundedSnapshotMeta {
    /// One of the `FIPC_SNAPSHOT_ORIGIN_*` constants.
    pub snapshot_origin: String,
    pub returned_events: u32,
    /// Events available in the collector view before applying `max_events` cap.
    pub available_in_view: u32,
    pub truncated_by_max_events: bool,
    /// Present for [`FIPC_SNAPSHOT_ORIGIN_COLLECTOR_STORE`]: increments on **replacement** only; stable for append-only tails.
    #[serde(default)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub store_revision: Option<u64>,
}

fn default_fipc_max_events() -> u32 {
    64
}

/// Optional bounded tail for live `session_delta` (v0): **collector_store** append-only events after a prior watermark.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct FipcLiveDeltaTailV0 {
    /// Client last acknowledged `available_in_view` from a prior `BoundedSnapshotReply` for this session.
    pub after_available_exclusive: u32,
    /// Must match [`FipcBoundedSnapshotMeta::store_revision`] from that prior reply.
    pub base_store_revision: u64,
}

/// One NDJSON line from bridge → collector on the provisional TCP link.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "msg", rename_all = "snake_case")]
pub enum FipcBridgeToCollector {
    Hello {
        wire_protocol_version: u32,
        auth_token_version: u32,
        /// Shared secret agreed out-of-band for this dev transport (not the bridge HTTP bearer).
        shared_secret: String,
    },
    BoundedSnapshotRequest {
        session_id: String,
        #[serde(default)]
        cursor: Option<String>,
        #[serde(default = "default_fipc_max_events")]
        max_events: u32,
        #[serde(default)]
        #[serde(skip_serializing_if = "Option::is_none")]
        live_delta_tail_v0: Option<FipcLiveDeltaTailV0>,
    },
}

/// One NDJSON line from collector → bridge.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "msg", rename_all = "snake_case")]
pub enum FipcCollectorToBridge {
    HelloAck {
        auth_token_version: u32,
    },
    HelloReject {
        code: String,
        message: String,
    },
    BoundedSnapshotReply {
        session_id: String,
        snapshot_cursor: String,
        events: Vec<serde_json::Value>,
        /// Still **false** in this skeleton (no live WS delta stream).
        live_session_ingest: bool,
        /// When set, Unix **ms** of last successful **retained** procfs poll that updated the store
        /// for this `session_id`. Omitted on per-RPC procfs replies and when never polled. **Provisional** telemetry.
        #[serde(default)]
        #[serde(skip_serializing_if = "Option::is_none")]
        retained_snapshot_unix_ms: Option<u64>,
        /// Bounded-view semantics (cursor honesty, truncation, feed path). Omitted only for wire-compat tests.
        #[serde(default)]
        #[serde(skip_serializing_if = "Option::is_none")]
        snapshot_meta: Option<FipcBoundedSnapshotMeta>,
        /// Normalized events appended after `live_delta_tail_v0.after_available_exclusive` when continuity holds.
        #[serde(default)]
        #[serde(skip_serializing_if = "Option::is_none")]
        live_delta_events: Option<Vec<serde_json::Value>>,
        /// Explains tail presence/absence (`FIPC_LIVE_DELTA_CONTINUITY_*`).
        #[serde(default)]
        #[serde(skip_serializing_if = "Option::is_none")]
        live_delta_continuity_v0: Option<String>,
    },
}

//! HTTP JSON shapes for the Phase 5 bridge skeleton. **Wire format is provisional** until F-04 closes.

use serde::Serialize;

use crate::resync::{ResyncHint, PROVISIONAL_BACKLOG_EVENT_THRESHOLD};

/// `GET /health` — intentionally **unauthenticated** for supervisor probes (no session data).
#[derive(Debug, Clone, Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub service: &'static str,
}

/// `GET /capabilities` — authenticated; describes resync constants and feature flags.
#[derive(Debug, Clone, Serialize)]
pub struct CapabilitiesResponse {
    pub bridge_api_version: u32,
    pub resync: ResyncCapabilities,
    pub websocket: WebSocketCapability,
    /// False until collector IPC + live ingest is wired (honest; not a product claim).
    pub live_session_ingest: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct ResyncCapabilities {
    pub provisional_backlog_event_threshold: u64,
    /// Mirrors [`crate::resync::ViewerRecoveryStrategy`] for JSON clients.
    pub recovery_strategy: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct WebSocketCapability {
    pub path: &'static str,
    /// Reserved for bounded delta stream; **not** emitting live events in this skeleton.
    pub delta_stream_status: &'static str,
}

/// Bounded snapshot (spec §18A.3: stale viewer fetches snapshot + new cursor; no session restart).
#[derive(Debug, Clone, Serialize)]
pub struct SessionSnapshotResponse {
    pub session_id: String,
    /// Cursor the client supplied, if any (`?cursor=`).
    pub cursor_requested: Option<String>,
    /// Opaque cursor covering the returned `events` slice (skeleton: stable placeholder when empty).
    pub snapshot_cursor: String,
    /// Normalized event envelopes as JSON values (empty until live ingest exists).
    pub events: Vec<serde_json::Value>,
    pub live_session_ingest: bool,
    /// When ingest exists, bridge may attach a hint; always `None` in skeleton.
    pub resync_hint: Option<ResyncHint>,
}

/// Initial cursor for an empty session timeline (opaque string; format TBD when F-04 closes).
pub const SNAPSHOT_CURSOR_EMPTY: &str = "v0:empty";

impl CapabilitiesResponse {
    pub fn skeleton() -> Self {
        Self {
            bridge_api_version: 1,
            resync: ResyncCapabilities {
                provisional_backlog_event_threshold: PROVISIONAL_BACKLOG_EVENT_THRESHOLD,
                recovery_strategy: "snapshot_and_cursor",
            },
            websocket: WebSocketCapability {
                path: "/ws",
                delta_stream_status: "handshake_only_no_live_deltas",
            },
            live_session_ingest: false,
        }
    }
}

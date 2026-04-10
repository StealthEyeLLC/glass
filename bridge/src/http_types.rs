//! HTTP JSON shapes for the Phase 5 bridge skeleton.
//!
//! **Bounded-era F-04 is frozen** — see `docs/PHASE0_FREEZE_TRACKER.md` (Closed F-04) and
//! `docs/contracts/bridge_session_snapshot_bounded_v0.schema.json`. Live delta / backlog extensions are not
//! frozen here.

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
    /// False until a live WS delta stream exists (honest; not a product claim).
    pub live_session_ingest: bool,
    pub collector_fipc: CollectorFipcCapability,
}

#[derive(Debug, Clone, Serialize)]
pub struct CollectorFipcCapability {
    pub transport: &'static str,
    pub configured: bool,
    pub wire_protocol_version: u32,
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
    /// `handshake_only_no_live_deltas` when F-IPC unset; `live_session_delta_skeleton_polling` when configured.
    pub delta_stream_status: &'static str,
    /// True when `GET /ws` can run bounded live-session subscribe + F-IPC polling (**not** final live ingest).
    pub live_session_delta_skeleton: bool,
}

/// Status of collector F-IPC for this snapshot (omitted when HTTP route did not use F-IPC).
#[derive(Debug, Clone, Serialize)]
pub struct CollectorIpcSnapshotMeta {
    pub transport: &'static str,
    pub status: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

/// Concrete bounded-snapshot contract (v0) when F-IPC returned metadata — **not** a live delta cursor.
///
/// **`snapshot_origin` disambiguates** `snapshot_cursor` when both unknown-empty and empty per-RPC polls use
/// `v0:empty` (F-04 closed).
#[derive(Debug, Clone, Serialize)]
pub struct BoundedSnapshotContractV0 {
    /// Mirrors collector `FipcBoundedSnapshotMeta.snapshot_origin` (`unknown_or_empty`, `collector_store`, …).
    pub snapshot_origin: String,
    pub returned_events: u32,
    pub available_in_view: u32,
    pub truncated_by_max_events: bool,
    /// Short label; see `CURSOR_SEMANTICS_BOUNDED_PREFIX_V0` for meaning.
    pub cursor_semantics: &'static str,
}

/// Explains `snapshot_cursor` strings for v0 (`v0:empty`, `v0:off:N`): bounded prefix / empty view, not resumable live log offsets.
pub const CURSOR_SEMANTICS_BOUNDED_PREFIX_V0: &str = "bounded_prefix_v0";

/// Bounded snapshot (spec §18A.3: stale viewer fetches snapshot + new cursor; no session restart).
///
/// **`snapshot_cursor` is opaque** (F-04 closed). When it equals [`SNAPSHOT_CURSOR_EMPTY`], use
/// `bounded_snapshot.snapshot_origin` to distinguish unknown session vs empty per-RPC poll.
///
/// If `resync_hint` is absent/`null`, that means **no extra bounded-era warning** — not “live-safe” or
/// “continuity-safe” (F-04 closed).
#[derive(Debug, Clone, Serialize)]
pub struct SessionSnapshotResponse {
    pub session_id: String,
    /// Cursor the client supplied, if any (`?cursor=`).
    pub cursor_requested: Option<String>,
    /// **Opaque** bounded-era cursor string (`v0:empty` \| `v0:off:0` \| `v0:off:N`) — label for **this**
    /// response only, not a resumable live log offset.
    pub snapshot_cursor: String,
    /// Normalized event envelopes as JSON values (from collector F-IPC when configured).
    pub events: Vec<serde_json::Value>,
    pub live_session_ingest: bool,
    /// When set, extra bounded-era semantics warning — truncation, non-incremental per-RPC poll, or retained
    /// tail replacement. Absent means no such warning, **not** a live/delta safety guarantee.
    pub resync_hint: Option<ResyncHint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub collector_ipc: Option<CollectorIpcSnapshotMeta>,
    /// Unix **ms** when collector last successfully refreshed retained snapshot data for this session; **provisional**; omitted when not applicable.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retained_snapshot_unix_ms: Option<u64>,
    /// Populated when the snapshot came from F-IPC with `snapshot_meta` (omitted when no F-IPC).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bounded_snapshot: Option<BoundedSnapshotContractV0>,
    /// Upper bound used for this HTTP request (mirrors F-IPC `max_events`; default 64).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_events_requested: Option<u32>,
}

/// Unknown session or empty per-RPC poll — same literal; disambiguate with `bounded_snapshot.snapshot_origin` (`docs/F03_F04_FREEZE_PROPOSAL.md`).
pub const SNAPSHOT_CURSOR_EMPTY: &str = "v0:empty";

impl CapabilitiesResponse {
    pub fn for_bridge_state(
        collector_fipc_configured: bool,
        fipc_wire_protocol_version: u32,
    ) -> Self {
        let ws_skeleton = collector_fipc_configured;
        Self {
            bridge_api_version: 1,
            resync: ResyncCapabilities {
                provisional_backlog_event_threshold: PROVISIONAL_BACKLOG_EVENT_THRESHOLD,
                recovery_strategy: "snapshot_and_cursor",
            },
            websocket: WebSocketCapability {
                path: "/ws",
                delta_stream_status: if ws_skeleton {
                    "live_session_delta_skeleton_polling"
                } else {
                    "handshake_only_no_live_deltas"
                },
                live_session_delta_skeleton: ws_skeleton,
            },
            live_session_ingest: false,
            collector_fipc: CollectorFipcCapability {
                transport: "provisional_tcp_loopback",
                configured: collector_fipc_configured,
                wire_protocol_version: fipc_wire_protocol_version,
            },
        }
    }
}

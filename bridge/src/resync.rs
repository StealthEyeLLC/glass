//! Stale-viewer resync contract (spec §18A.3, build plan).
//!
//! **Bounded-era F-04 is frozen:** [`RESYNC_HINT_REASON_*`] are the single source of truth for JSON
//! `resync_hint.reason` on `GET /sessions/:id/snapshot` — see `docs/PHASE0_FREEZE_TRACKER.md` (Closed F-04).
//! [`PROVISIONAL_BACKLOG_EVENT_THRESHOLD`] and live backlog / `ipc_gap` reasons remain **deferred** until live
//! ingest exists. **F-03** live WS queue caps: [`crate::live_session_ws`] (`F03_V0_LIVE_WS_QUEUE_MAX_*`); this
//! threshold is **separate** (capabilities / future ingest). Memo: `docs/F03_LIVE_BACKLOG_FREEZE_PROPOSAL.md`.
//! Mapping logic: [`crate::snapshot_contract`].

use serde::{Deserialize, Serialize};

/// When pending outbound delta events exceed this count, the viewer should discard backlog and resync.
pub const PROVISIONAL_BACKLOG_EVENT_THRESHOLD: u64 = 10_000;

/// `resync_hint.reason` when `truncated_by_max_events` is true (more events existed than returned).
pub const RESYNC_HINT_REASON_BOUNDED_TRUNCATION: &str = "bounded_truncation";

/// `resync_hint.reason` for per-RPC procfs / file-lane polls (not a delta continuation).
pub const RESYNC_HINT_REASON_PER_RPC_POLL_NOT_INCREMENTAL: &str =
    "per_rpc_poll_snapshot_not_incremental";

/// `resync_hint.reason` when retained loop replaces a bounded tail (not append-only history).
pub const RESYNC_HINT_REASON_RETAINED_TAIL_REPLACES: &str =
    "retained_snapshot_tail_replaces_not_append_only";

/// Hint payload — bounded-era `reason` values are **frozen** ([`RESYNC_HINT_REASON_*`]). **`detail`** is
/// optional and **non-normative** (debug/operator text).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResyncHint {
    pub reason: String,
    pub snapshot_cursor: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

/// Recovery must use fresh bounded snapshot + new cursor; session does not restart.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ViewerRecoveryStrategy {
    SnapshotAndCursor,
}

pub fn expected_recovery() -> ViewerRecoveryStrategy {
    ViewerRecoveryStrategy::SnapshotAndCursor
}

//! Stale-viewer resync contract (spec §18A.3, build plan).
//!
//! **Provisional defaults** — confirm in `docs/PHASE0_FREEZE_TRACKER.md`. Bounded snapshot hints (non-live)
//! are implemented in [`crate::snapshot_contract`]; live backlog / `ipc_gap` reasons remain future work.
//!
//! **Freeze prep:** wire tokens for bounded-era `resync_hint.reason` are aliased below — see
//! `docs/F03_F04_FREEZE_PROPOSAL.md` (human sign-off still required; not normative until tracker closes F-04).

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

/// Hint payload — JSON `reason` uses [`RESYNC_HINT_REASON_*`] tokens for bounded era; live reasons TBD.
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

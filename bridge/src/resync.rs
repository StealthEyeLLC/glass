//! Stale-viewer resync contract (spec §18A.3, build plan).
//!
//! **Provisional defaults** — confirm in `docs/PHASE0_FREEZE_TRACKER.md`. Bounded snapshot hints (non-live)
//! are implemented in [`crate::snapshot_contract`]; live backlog / `ipc_gap` reasons remain future work.

use serde::{Deserialize, Serialize};

/// When pending outbound delta events exceed this count, the viewer should discard backlog and resync.
pub const PROVISIONAL_BACKLOG_EVENT_THRESHOLD: u64 = 10_000;

/// Hint payload (F-04 still provisional — reason strings are stable enough for tests, not a frozen enum).
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

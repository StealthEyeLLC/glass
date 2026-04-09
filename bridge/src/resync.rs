//! Stale-viewer resync contract (spec §18A.3, build plan).
//!
//! **Provisional defaults** — confirm in `docs/PHASE0_FREEZE_TRACKER.md`.

use serde::{Deserialize, Serialize};

/// When pending outbound delta events exceed this count, the viewer should discard backlog and resync.
pub const PROVISIONAL_BACKLOG_EVENT_THRESHOLD: u64 = 10_000;

/// Hint payload (shape only; wire JSON TBD).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ResyncHint {
    pub reason: String,
    pub snapshot_cursor: String,
}

/// Recovery must use fresh bounded snapshot + new cursor; session does not restart.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ViewerRecoveryStrategy {
    SnapshotAndCursor,
}

pub fn expected_recovery() -> ViewerRecoveryStrategy {
    ViewerRecoveryStrategy::SnapshotAndCursor
}

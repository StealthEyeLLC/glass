//! File-lane (directory poll / fixture) → normalize → JSON for **bounded** F-IPC snapshots.
//! Per-request poll + ingest — **not** a live stream.

use std::path::PathBuf;

use crate::file_session::{
    ingest_file_lane_raw_to_session_log, load_file_lane_observations_for_cli,
};
use crate::self_silence::SelfSilencePolicy;

/// When set on `ipc-serve`, `BoundedSnapshotRequest` for matching `session_id` is answered from a
/// **fresh** file-lane poll under [`FileLaneSnapshotFeedConfig::watch_root`] or
/// `--file-lane-from-raw-json` each RPC (capped by request + `PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS`).
/// Does not share state with procfs feed or `SnapshotStore` unless the same session is seeded there.
#[derive(Debug, Clone)]
pub struct FileLaneSnapshotFeedConfig {
    pub session_id: String,
    /// Used when `from_raw_json` is `None`; must be an existing directory at poll time.
    pub watch_root: PathBuf,
    pub max_samples: usize,
    pub max_depth: usize,
    pub twice: bool,
    pub from_raw_json: Option<PathBuf>,
}

impl FileLaneSnapshotFeedConfig {
    /// Normalize current poll/fixture batch to JSON event values (bounded by adapter caps before F-IPC clamp).
    pub fn poll_normalized_json(&self) -> Result<Vec<serde_json::Value>, String> {
        let obs = load_file_lane_observations_for_cli(
            self.session_id.clone(),
            self.watch_root.clone(),
            self.max_samples,
            self.max_depth,
            self.twice,
            self.from_raw_json.clone(),
        )?;
        let log = ingest_file_lane_raw_to_session_log(obs, &SelfSilencePolicy::default())
            .map_err(|e| format!("session ingest: {e}"))?;
        log.events()
            .iter()
            .map(|e| serde_json::to_value(e).map_err(|e| format!("serialize event: {e}")))
            .collect()
    }
}

//! Procfs (or fixture) → normalize → JSON values for **bounded** F-IPC snapshots.
//! Per-request poll + ingest — **not** a live event stream.

use std::path::PathBuf;

use crate::adapters::{CollectorAdapter, ProcfsProcessAdapter};
use crate::procfs_session::ingest_procfs_raw_to_session_log;
use crate::raw::RawObservation;
use crate::self_silence::SelfSilencePolicy;

/// Load `RawObservation[]` the same way as `glass-collector normalize-procfs` / `export-procfs-pack`.
pub fn load_procfs_observations_for_cli(
    session: String,
    max_samples: usize,
    twice: bool,
    from_raw_json: Option<PathBuf>,
) -> Result<Vec<RawObservation>, String> {
    match from_raw_json {
        Some(path) => {
            let s = std::fs::read_to_string(&path)
                .map_err(|e| format!("read {}: {e}", path.display()))?;
            serde_json::from_str(&s).map_err(|e| format!("parse raw JSON: {e}"))
        }
        None => {
            if !cfg!(target_os = "linux") {
                return Err("on non-Linux use --from-raw-json or run on Linux.".to_string());
            }
            let mut a = ProcfsProcessAdapter::new(session);
            a.max_samples_per_poll = max_samples;
            let mut batch = a.poll_raw().map_err(|e| format!("poll: {e}"))?;
            if twice {
                match a.poll_raw() {
                    Ok(b2) => batch.extend(b2),
                    Err(e) => eprintln!("second poll: {e}"),
                }
            }
            Ok(batch)
        }
    }
}

/// When set on `ipc-serve`, `BoundedSnapshotRequest` for matching `session_id` is answered from a
/// **fresh** procfs poll (or `--procfs-from-raw-json`) + `ingest_procfs_raw_to_session_log` each RPC
/// (still capped by request + `PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS`). Other sessions use
/// [`crate::ipc_dev_tcp::SnapshotStore`] only.
#[derive(Debug, Clone)]
pub struct ProcfsSnapshotFeedConfig {
    pub session_id: String,
    pub max_samples: usize,
    pub twice: bool,
    pub from_raw_json: Option<PathBuf>,
}

impl ProcfsSnapshotFeedConfig {
    /// Normalize current procfs/fixture batch to JSON event values (bounded only by poll caps).
    pub fn poll_normalized_json(&self) -> Result<Vec<serde_json::Value>, String> {
        let obs = load_procfs_observations_for_cli(
            self.session_id.clone(),
            self.max_samples,
            self.twice,
            self.from_raw_json.clone(),
        )?;
        let log = ingest_procfs_raw_to_session_log(obs, &SelfSilencePolicy::default())
            .map_err(|e| format!("session ingest: {e}"))?;
        log.events()
            .iter()
            .map(|e| serde_json::to_value(e).map_err(|e| format!("serialize event: {e}")))
            .collect()
    }
}

//! Optional background file-lane (directory poll or fixture) that writes **bounded** normalized JSON
//! into [`crate::ipc_dev_tcp::SnapshotStore`] for one session. F-IPC reads use the **retained** store
//! without per-RPC repoll. **Not** a live WS delta stream — bounded snapshot materialization only.

use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use crate::file_lane_ipc_feed::FileLaneSnapshotFeedConfig;
use crate::ipc_dev_tcp::{unix_epoch_millis_now, RetainedPollMeta, SnapshotStore};
use crate::procfs_retained_loop::PROVISIONAL_MAX_RETAINED_SNAPSHOT_EVENTS;

#[derive(Debug, Clone)]
pub struct RetainedFileLaneLoopConfig {
    pub feed: FileLaneSnapshotFeedConfig,
    pub interval: Duration,
    pub max_retained_events: usize,
}

impl RetainedFileLaneLoopConfig {
    pub fn clamped_max_retained(&self) -> usize {
        self.max_retained_events
            .clamp(1, PROVISIONAL_MAX_RETAINED_SNAPSHOT_EVENTS)
    }
}

/// Single poll → normalize → **replace** session events in `store`, keeping the **tail** up to
/// `max_retained`. Updates `meta.last_ok_unix_ms` on success (including empty poll results).
pub fn retained_file_lane_poll_tick(
    store: &SnapshotStore,
    feed: &FileLaneSnapshotFeedConfig,
    max_retained: usize,
    meta: Option<&RetainedPollMeta>,
) -> Result<(), String> {
    let mut events = feed.poll_normalized_json()?;
    let cap = max_retained.clamp(1, PROVISIONAL_MAX_RETAINED_SNAPSHOT_EVENTS);
    if events.len() > cap {
        let drop_n = events.len() - cap;
        events.drain(..drop_n);
    }
    store.set_session_events(feed.session_id.clone(), events);
    if let Some(m) = meta {
        m.last_ok_unix_ms
            .store(unix_epoch_millis_now(), Ordering::Relaxed);
    }
    Ok(())
}

/// Spawn a thread that polls forever (interval between **end of one tick** and **start of next**).
pub fn spawn_retained_file_lane_loop(
    store: Arc<SnapshotStore>,
    cfg: RetainedFileLaneLoopConfig,
    meta: Arc<RetainedPollMeta>,
) -> thread::JoinHandle<()> {
    let interval = cfg.interval;
    let max_ret = cfg.clamped_max_retained();
    let feed = cfg.feed.clone();
    thread::spawn(move || loop {
        if let Err(e) =
            retained_file_lane_poll_tick(store.as_ref(), &feed, max_ret, Some(meta.as_ref()))
        {
            eprintln!("ipc-serve: retained file-lane poll failed: {e}");
        }
        thread::sleep(interval);
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capability::AdapterId;
    use crate::raw::{RawObservation, RawObservationKind, RawSourceQuality};
    use tempfile::tempdir;

    fn fl_sample(session: &str, seq: u64, rel: &str) -> RawObservation {
        RawObservation::new(
            seq,
            session,
            seq.saturating_mul(10),
            RawObservationKind::FileSeenInPollSnapshot,
            RawSourceQuality::DirectoryPollDerived,
            AdapterId::FsFileLane,
            serde_json::json!({
                "semantics": "bounded_directory_poll_snapshot",
                "relative_path": rel,
                "size_bytes": 1,
                "modified_unix_secs": 1,
                "poll_monotonic_ns": seq,
                "scan": { "files_seen_total": 1, "samples_returned": 1, "truncated_by_sample_budget": false, "state_budget_truncated": false, "max_depth": 4 },
                "watch_root": "/tmp/rfl",
                "first_poll_baseline": true,
            }),
        )
    }

    #[test]
    fn tick_keeps_tail_and_updates_meta() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("fl_r.json");
        let raw: Vec<_> = (1u64..=5)
            .map(|i| fl_sample("fl_tail_sess", i, &format!("f{i}.txt")))
            .collect();
        std::fs::write(&path, serde_json::to_string(&raw).unwrap()).unwrap();

        let feed = FileLaneSnapshotFeedConfig {
            session_id: "fl_tail_sess".to_string(),
            watch_root: dir.path().to_path_buf(),
            max_samples: 512,
            max_depth: 8,
            twice: false,
            from_raw_json: Some(path),
        };
        let store = SnapshotStore::new();
        let meta = RetainedPollMeta::new("fl_tail_sess");
        assert_eq!(meta.last_ok_unix_ms.load(Ordering::Relaxed), 0);
        retained_file_lane_poll_tick(&store, &feed, 2, Some(&meta)).unwrap();
        let (ev, cur, _, _, _) = store.get_bounded("fl_tail_sess", 10);
        assert_eq!(ev.len(), 2);
        assert_eq!(cur, "v0:off:2");
        assert!(meta.last_ok_unix_ms.load(Ordering::Relaxed) > 0);
    }

    #[test]
    fn tick_empty_raw_array_still_updates_meta() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("e.json");
        std::fs::write(&path, "[]").unwrap();
        let feed = FileLaneSnapshotFeedConfig {
            session_id: "fl_empty_r".to_string(),
            watch_root: std::path::PathBuf::from("."),
            max_samples: 512,
            max_depth: 8,
            twice: false,
            from_raw_json: Some(path),
        };
        let store = SnapshotStore::new();
        let meta = RetainedPollMeta::new("fl_empty_r");
        retained_file_lane_poll_tick(&store, &feed, 64, Some(&meta)).unwrap();
        let (ev, _, _, _, _) = store.get_bounded("fl_empty_r", 10);
        assert!(ev.is_empty());
        assert!(meta.last_ok_unix_ms.load(Ordering::Relaxed) > 0);
    }
}

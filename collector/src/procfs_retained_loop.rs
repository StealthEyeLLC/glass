//! Optional background procfs (or fixture) poll that writes **bounded** normalized JSON into
//! [`crate::ipc_dev_tcp::SnapshotStore`] for one session. Bridge F-IPC reads see **retained** state
//! without per-RPC repoll. Each tick uses [`SnapshotStore::apply_retained_poll_continuity`] — **prefix
//! extension** of the normalized poll keeps **`store_revision`**; otherwise **replace** (revision bump).

use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use crate::ipc::PROVISIONAL_MAX_RETAINED_SNAPSHOT_EVENTS;
use crate::ipc_dev_tcp::{unix_epoch_millis_now, RetainedPollMeta, SnapshotStore};
use crate::procfs_ipc_feed::ProcfsSnapshotFeedConfig;

#[derive(Debug, Clone)]
pub struct RetainedProcfsLoopConfig {
    pub feed: ProcfsSnapshotFeedConfig,
    pub interval: Duration,
    pub max_retained_events: usize,
}

impl RetainedProcfsLoopConfig {
    pub fn clamped_max_retained(&self) -> usize {
        self.max_retained_events
            .clamp(1, PROVISIONAL_MAX_RETAINED_SNAPSHOT_EVENTS)
    }
}

/// Single poll → normalize → update `store` with **prefix continuity** when the full poll extends the
/// prior retained timeline (same revision); otherwise **replace** (new revision). Tail is capped at
/// `max_retained`. Updates `meta.last_ok_unix_ms` on success.
pub fn retained_procfs_poll_tick(
    store: &SnapshotStore,
    feed: &ProcfsSnapshotFeedConfig,
    max_retained: usize,
    meta: Option<&RetainedPollMeta>,
) -> Result<(), String> {
    let events = feed.poll_normalized_json()?;
    let cap = max_retained.clamp(1, PROVISIONAL_MAX_RETAINED_SNAPSHOT_EVENTS);
    store.apply_retained_poll_continuity(&feed.session_id, events, cap);
    if let Some(m) = meta {
        m.last_ok_unix_ms
            .store(unix_epoch_millis_now(), Ordering::Relaxed);
    }
    Ok(())
}

/// Spawn a thread that polls forever (interval between **end of one tick** and **start of next**).
pub fn spawn_retained_procfs_loop(
    store: Arc<SnapshotStore>,
    cfg: RetainedProcfsLoopConfig,
    meta: Arc<RetainedPollMeta>,
) -> thread::JoinHandle<()> {
    let interval = cfg.interval;
    let max_ret = cfg.clamped_max_retained();
    let feed = cfg.feed.clone();
    thread::spawn(move || loop {
        if let Err(e) =
            retained_procfs_poll_tick(store.as_ref(), &feed, max_ret, Some(meta.as_ref()))
        {
            eprintln!("ipc-serve: retained procfs poll failed: {e}");
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

    fn sample(session: &str, seq: u64, pid: u32) -> RawObservation {
        RawObservation::new(
            seq,
            session,
            seq.saturating_mul(10),
            RawObservationKind::ProcessSample,
            RawSourceQuality::ProcfsDerived,
            AdapterId::ProcfsProcess,
            serde_json::json!({
                "semantics": "procfs_poll_snapshot",
                "pid": pid,
                "comm": "t",
                "ppid": 1,
            }),
        )
    }

    #[test]
    fn tick_keeps_tail_and_updates_meta() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("r.json");
        let raw: Vec<_> = (1u64..=5)
            .map(|i| sample("tail_sess", i, i as u32))
            .collect();
        std::fs::write(&path, serde_json::to_string(&raw).unwrap()).unwrap();

        let feed = ProcfsSnapshotFeedConfig {
            session_id: "tail_sess".to_string(),
            max_samples: 512,
            twice: false,
            from_raw_json: Some(path),
        };
        let store = SnapshotStore::new();
        let meta = RetainedPollMeta::new("tail_sess");
        assert_eq!(meta.last_ok_unix_ms.load(Ordering::Relaxed), 0);
        retained_procfs_poll_tick(&store, &feed, 2, Some(&meta)).unwrap();
        let (ev, cur, _, _, _) = store.get_bounded("tail_sess", 10);
        assert_eq!(ev.len(), 2);
        assert_eq!(cur, "v0:off:2");
        assert!(meta.last_ok_unix_ms.load(Ordering::Relaxed) > 0);
    }

    #[test]
    fn tick_extends_prefix_keeps_store_revision() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("grow.json");
        let raw5: Vec<_> = (1u64..=5)
            .map(|i| sample("grow_sess", i, i as u32))
            .collect();
        std::fs::write(&path, serde_json::to_string(&raw5).unwrap()).unwrap();

        let feed = ProcfsSnapshotFeedConfig {
            session_id: "grow_sess".to_string(),
            max_samples: 512,
            twice: false,
            from_raw_json: Some(path.clone()),
        };
        let store = SnapshotStore::new();
        retained_procfs_poll_tick(&store, &feed, 512, None).unwrap();
        let (_, _, t1, _, rev1) = store.get_bounded("grow_sess", 10_000);

        let raw6: Vec<_> = (1u64..=6)
            .map(|i| sample("grow_sess", i, i as u32))
            .collect();
        std::fs::write(&path, serde_json::to_string(&raw6).unwrap()).unwrap();
        retained_procfs_poll_tick(&store, &feed, 512, None).unwrap();
        let (_, _, t2, _, rev2) = store.get_bounded("grow_sess", 10_000);

        assert_eq!(t2, t1 + 1);
        assert_eq!(rev1, rev2, "prefix extension must not bump store_revision");
    }

    #[test]
    fn tick_non_prefix_replaces_and_bumps_revision() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("sw.json");
        let raw_a: Vec<_> = (1u64..=3).map(|i| sample("sw_sess", i, i as u32)).collect();
        std::fs::write(&path, serde_json::to_string(&raw_a).unwrap()).unwrap();

        let feed = ProcfsSnapshotFeedConfig {
            session_id: "sw_sess".to_string(),
            max_samples: 512,
            twice: false,
            from_raw_json: Some(path.clone()),
        };
        let store = SnapshotStore::new();
        retained_procfs_poll_tick(&store, &feed, 512, None).unwrap();
        let (_, _, _, _, rev1) = store.get_bounded("sw_sess", 10);

        let raw_b: Vec<_> = (10u64..=11)
            .map(|i| sample("sw_sess", i, i as u32))
            .collect();
        std::fs::write(&path, serde_json::to_string(&raw_b).unwrap()).unwrap();
        retained_procfs_poll_tick(&store, &feed, 512, None).unwrap();
        let (_, _, t2, _, rev2) = store.get_bounded("sw_sess", 10);

        assert_eq!(t2, 2);
        assert!(rev2 > rev1);
    }

    #[test]
    fn tick_empty_raw_array_still_updates_meta() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("e.json");
        std::fs::write(&path, "[]").unwrap();
        let feed = ProcfsSnapshotFeedConfig {
            session_id: "empty_r".to_string(),
            max_samples: 512,
            twice: false,
            from_raw_json: Some(path),
        };
        let store = SnapshotStore::new();
        let meta = RetainedPollMeta::new("empty_r");
        retained_procfs_poll_tick(&store, &feed, 64, Some(&meta)).unwrap();
        let (ev, _, _, _, _) = store.get_bounded("empty_r", 10);
        assert!(ev.is_empty());
        assert!(meta.last_ok_unix_ms.load(Ordering::Relaxed) > 0);
    }

    #[test]
    #[cfg(not(target_os = "linux"))]
    fn tick_without_fixture_errors_on_non_linux() {
        let feed = ProcfsSnapshotFeedConfig {
            session_id: "x".to_string(),
            max_samples: 8,
            twice: false,
            from_raw_json: None,
        };
        let store = SnapshotStore::new();
        let meta = RetainedPollMeta::new("x");
        assert!(retained_procfs_poll_tick(&store, &feed, 64, Some(&meta)).is_err());
        assert_eq!(meta.last_ok_unix_ms.load(Ordering::Relaxed), 0);
    }
}

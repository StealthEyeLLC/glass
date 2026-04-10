//! Deterministic fs_file_lane adapter tests (temp dirs).

use glass_collector::{
    build_fidelity_report, ingest_file_lane_raw_to_session_log, AdapterId, CollectorAdapter,
    FsFileLaneAdapter, PrivilegeMode, RawObservationKind, SelfSilencePolicy,
};
use std::fs;
use std::io::Write;
use tempfile::tempdir;

fn touch(path: &std::path::Path, body: &[u8]) {
    let mut f = fs::File::create(path).expect("create");
    f.write_all(body).expect("write");
    f.sync_all().expect("sync");
}

#[test]
fn inactive_without_watch_root() {
    let mut a = FsFileLaneAdapter::new("s");
    let m = a.capability_manifest();
    assert!(!m.implementation_active);
    assert!(m.supports_today.iter().any(|x| x.contains("inactive")));
    let obs = a.poll_raw().expect("poll");
    assert!(obs.is_empty());
}

#[test]
fn first_poll_only_snapshot_observations() {
    let dir = tempdir().expect("tempdir");
    touch(&dir.path().join("a.txt"), b"hi");

    let mut a = FsFileLaneAdapter::with_watch_root("sess", dir.path().to_path_buf());
    a.max_files_per_scan = 64;
    a.max_depth = 4;

    let obs = a.poll_raw().expect("poll");
    assert!(!obs.is_empty());
    assert!(obs
        .iter()
        .all(|o| o.kind == RawObservationKind::FileSeenInPollSnapshot));
    assert!(obs
        .iter()
        .all(|o| o.source_adapter == AdapterId::FsFileLane));
    let m = a.capability_manifest();
    assert!(m.implementation_active);

    let log =
        ingest_file_lane_raw_to_session_log(obs, &SelfSilencePolicy::default()).expect("ingest");
    assert!(!log.is_empty());
    assert!(log.events().iter().all(|e| e.kind == "file_poll_snapshot"));
}

#[test]
fn second_poll_emits_gap_and_change_when_file_mutates() {
    let dir = tempdir().expect("tempdir");
    let p = dir.path().join("mut.txt");
    touch(&p, b"v1");

    let mut a = FsFileLaneAdapter::with_watch_root("sess", dir.path().to_path_buf());
    a.max_files_per_scan = 64;
    a.max_depth = 4;
    a.poll_raw().expect("poll1");

    // Ensure mtime/size change is visible across polls.
    touch(&p, b"v2-longer");

    let obs2 = a.poll_raw().expect("poll2");
    let kinds: Vec<_> = obs2.iter().map(|o| &o.kind).collect();
    assert!(
        kinds.contains(&&RawObservationKind::FileChangedBetweenPolls),
        "expected change observation, got kinds: {kinds:?}"
    );
    assert!(
        kinds.contains(&&RawObservationKind::FileSeenInPollSnapshot),
        "expected snapshot row"
    );
}

#[test]
fn fidelity_report_notes_fs_lane_when_configured() {
    let dir = tempdir().expect("tempdir");
    touch(&dir.path().join("x.txt"), b"1");
    let adapters: Vec<Box<dyn glass_collector::CollectorAdapter>> = vec![Box::new(
        FsFileLaneAdapter::with_watch_root("s", dir.path().to_path_buf()),
    )];
    let r = build_fidelity_report(PrivilegeMode::Unprivileged, &adapters);
    assert!(r.summary_for_operator.contains("fs_file_lane"));
}

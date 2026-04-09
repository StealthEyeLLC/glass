//! Linux-only: `ProcfsProcessAdapter` against a temp `proc/` tree (stable; no host `/proc` assumptions).

#[cfg(target_os = "linux")]
use std::path::PathBuf;

#[cfg(target_os = "linux")]
use glass_collector::{CollectorAdapter, ProcfsProcessAdapter, RawObservationKind};

#[cfg(target_os = "linux")]
#[test]
fn fixture_proc_tree_emits_process_sample() {
    let tmp = tempfile::tempdir().unwrap();
    let proc = tmp.path().join("proc");
    std::fs::create_dir(&proc).unwrap();
    let p1 = proc.join("1");
    std::fs::create_dir(&p1).unwrap();
    std::fs::write(p1.join("comm"), "fixtureproc\n").unwrap();
    std::fs::write(p1.join("status"), "Name:fixture\nPPid:\t2\n").unwrap();
    std::fs::write(
        p1.join("stat"),
        "1 (fixtureproc) S 2 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 999 0\n",
    )
    .unwrap();

    let mut a = ProcfsProcessAdapter::with_procfs_root("fixture-session", proc);
    let r = a.poll_raw().unwrap();
    let samples: Vec<_> = r
        .iter()
        .filter(|o| matches!(o.kind, RawObservationKind::ProcessSample))
        .collect();
    assert_eq!(samples.len(), 1);
    assert_eq!(samples[0].payload["pid"], 1);
    assert_eq!(samples[0].payload["comm"], "fixtureproc");
    assert_eq!(
        samples[0].payload["semantics"].as_str(),
        Some("procfs_poll_snapshot")
    );
}

#[cfg(target_os = "linux")]
#[test]
fn second_poll_emits_poll_gap_delta_for_new_pid() {
    let tmp = tempfile::tempdir().unwrap();
    let proc = tmp.path().join("proc");
    std::fs::create_dir(&proc).unwrap();

    fn write_pid(dir: &std::path::Path, pid: u32, comm: &str) {
        let p = dir.join(pid.to_string());
        std::fs::create_dir(&p).unwrap();
        std::fs::write(p.join("comm"), format!("{comm}\n")).unwrap();
        std::fs::write(p.join("status"), "PPid:\t0\n").unwrap();
        std::fs::write(
            p.join("stat"),
            format!("{pid} ({comm}) S 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 100{pid} 0\n"),
        )
        .unwrap();
    }

    write_pid(&proc, 10, "a");

    let mut a = ProcfsProcessAdapter::with_procfs_root("d", PathBuf::from(&proc));
    let _ = a.poll_raw().unwrap();

    write_pid(&proc, 11, "b");

    let r2 = a.poll_raw().unwrap();
    assert!(r2.iter().any(|o| {
        matches!(o.kind, RawObservationKind::ProcessSeenInPollGap) && o.payload["pid"] == 11
    }));
}

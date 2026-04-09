//! Subprocess tests for the `glass-pack` binary (`CARGO_BIN_EXE_glass-pack`).

use std::process::Command;

use session_engine::{
    materialize_share_safe_procfs_pack_bytes, normalize_procfs_batch, write_glass_pack_to_vec,
    ProcfsRawObservationDto, SessionLog, SessionManifest,
};

fn sample_dto() -> ProcfsRawObservationDto {
    ProcfsRawObservationDto {
        observation_seq: 1,
        session_id: "cli_t".to_string(),
        ts_monotonic_ns: 1,
        raw_kind: "process_sample".to_string(),
        payload: serde_json::json!({"pid": 1, "comm": "c", "semantics": "procfs_poll_snapshot"}),
    }
}

#[test]
fn validate_expect_share_safe_strict_json_ok() {
    let evs = normalize_procfs_batch(&[sample_dto()]).unwrap();
    let bytes = materialize_share_safe_procfs_pack_bytes(&evs, "cli_t").unwrap();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("s.glass_pack");
    std::fs::write(&path, bytes).unwrap();

    let out = Command::new(env!("CARGO_BIN_EXE_glass-pack"))
        .args([
            "validate",
            path.to_str().unwrap(),
            "--strict-kinds",
            "--expect-share-safe",
            "--json",
        ])
        .output()
        .expect("spawn glass-pack");

    assert!(
        out.status.success(),
        "stderr={}",
        String::from_utf8_lossy(&out.stderr)
    );
    let v: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(v["ok"], true);
    assert_eq!(v["strict_kinds"], true);
    assert_eq!(v["share_safe_markers_complete"], true);
}

#[test]
fn validate_expect_raw_dev_ok() {
    let mut log = SessionLog::new();
    log.append_procfs_dtos(&[sample_dto()]).unwrap();
    let m = SessionManifest::procfs_poll_dev_scaffold("cli_t");
    let bytes = write_glass_pack_to_vec(&m, log.events()).unwrap();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("r.glass_pack");
    std::fs::write(&path, bytes).unwrap();

    let out = Command::new(env!("CARGO_BIN_EXE_glass-pack"))
        .args(["validate", path.to_str().unwrap(), "--expect-raw-dev"])
        .output()
        .expect("spawn glass-pack");
    assert!(
        out.status.success(),
        "{}",
        String::from_utf8_lossy(&out.stderr)
    );
}

#[test]
fn validate_expect_raw_dev_fails_on_share_safe_pack() {
    let evs = normalize_procfs_batch(&[sample_dto()]).unwrap();
    let bytes = materialize_share_safe_procfs_pack_bytes(&evs, "cli_t").unwrap();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("bad.glass_pack");
    std::fs::write(&path, bytes).unwrap();

    let out = Command::new(env!("CARGO_BIN_EXE_glass-pack"))
        .args(["validate", path.to_str().unwrap(), "--expect-raw-dev"])
        .output()
        .expect("spawn glass-pack");
    assert!(!out.status.success());
    let err = String::from_utf8_lossy(&out.stderr);
    assert!(err.contains("raw/dev manifest check failed"), "got {err}");
}

#[test]
fn validate_expect_share_safe_fails_on_raw_pack() {
    let mut log = SessionLog::new();
    log.append_procfs_dtos(&[sample_dto()]).unwrap();
    let m = SessionManifest::procfs_poll_dev_scaffold("cli_t");
    let bytes = write_glass_pack_to_vec(&m, log.events()).unwrap();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("raw.glass_pack");
    std::fs::write(&path, bytes).unwrap();

    let out = Command::new(env!("CARGO_BIN_EXE_glass-pack"))
        .args(["validate", path.to_str().unwrap(), "--expect-share-safe"])
        .output()
        .expect("spawn glass-pack");
    assert!(!out.status.success());
    let err = String::from_utf8_lossy(&out.stderr);
    assert!(
        err.contains("share-safe manifest check failed"),
        "got {err}"
    );
}

#[test]
fn info_json_includes_lane_hint() {
    let evs = normalize_procfs_batch(&[sample_dto()]).unwrap();
    let bytes = materialize_share_safe_procfs_pack_bytes(&evs, "cli_t").unwrap();
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("i.glass_pack");
    std::fs::write(&path, bytes).unwrap();

    let out = Command::new(env!("CARGO_BIN_EXE_glass-pack"))
        .args(["info", path.to_str().unwrap(), "--json"])
        .output()
        .expect("spawn glass-pack");
    assert!(out.status.success());
    let v: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(
        v["artifact_lane_hint"].as_str(),
        Some("share_safe_export_markers_complete")
    );
    assert_eq!(v["share_safe_markers_complete"], true);
    assert!(v["human_readable_redaction_summary"].as_array().is_some());
}

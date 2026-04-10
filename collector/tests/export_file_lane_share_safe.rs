//! File-lane → provisional share-safe pack (export lane); F-05 not final.

use glass_collector::{
    ingest_file_lane_raw_to_session_log, AdapterId, RawObservation, RawObservationKind,
    RawSourceQuality, SelfSilencePolicy,
};
use session_engine::{
    materialize_share_safe_file_lane_pack_bytes, validate_glass_pack_bytes_strict, SessionLog,
};

fn raw_snapshot(session: &str, rel: &str, watch: &str) -> RawObservation {
    RawObservation::new(
        1,
        session,
        100,
        RawObservationKind::FileSeenInPollSnapshot,
        RawSourceQuality::DirectoryPollDerived,
        AdapterId::FsFileLane,
        serde_json::json!({
            "semantics": "bounded_directory_poll_snapshot",
            "relative_path": rel,
            "size_bytes": 3,
            "modified_unix_secs": 1,
            "poll_monotonic_ns": 1,
            "scan": { "files_seen_total": 1, "samples_returned": 1, "truncated_by_sample_budget": false, "state_budget_truncated": false, "max_depth": 4 },
            "watch_root": watch,
            "first_poll_baseline": true,
        }),
    )
}

#[test]
fn export_file_lane_share_safe_pack_strict_roundtrip() {
    let raw = vec![raw_snapshot(
        "exp_fl_sess",
        "corp_secrets/readme.md",
        "/var/top_secret/watch",
    )];
    let log = ingest_file_lane_raw_to_session_log(raw, &SelfSilencePolicy::default()).unwrap();
    let bytes = materialize_share_safe_file_lane_pack_bytes(log.events(), "exp_fl_sess")
        .expect("materialize");

    validate_glass_pack_bytes_strict(&bytes).expect("strict validate");

    let (log2, m) = SessionLog::load_from_pack_bytes_strict(&bytes).unwrap();
    assert!(m.sanitized);
    assert_eq!(
        m.export_sanitization_profile.as_deref(),
        Some("sanitize_default")
    );
    assert!(!m.human_readable_redaction_summary.is_empty());
    assert!(m
        .human_readable_redaction_summary
        .iter()
        .any(|l| l.contains("file_lane")));
    assert_eq!(log2.len(), 1);
    assert_eq!(
        log2.events()[0].attrs["relative_path"].as_str(),
        Some("[REDACTED_REL_PATH]")
    );
    assert_eq!(log2.events()[0].actor.entity_id, "fs_poll_rel:[REDACTED]");
    let blob = serde_json::to_string(log2.events()).unwrap();
    assert!(!blob.contains("top_secret"));
    assert!(!blob.contains("corp_secrets"));
}

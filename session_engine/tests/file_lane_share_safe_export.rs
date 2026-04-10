use session_engine::{
    materialize_share_safe_file_lane_pack_bytes, normalize_file_lane_batch,
    validate_glass_pack_bytes_strict, FileLaneRawObservationDto, SessionLog,
};

#[test]
fn file_lane_dto_to_share_safe_pack_strict_loads() {
    let dto = FileLaneRawObservationDto {
        observation_seq: 1,
        session_id: "fl_share".to_string(),
        ts_monotonic_ns: 7,
        raw_kind: "file_seen_in_poll_snapshot".to_string(),
        payload: serde_json::json!({
            "semantics": "bounded_directory_poll_snapshot",
            "relative_path": "secret_project/src/main.rs",
            "size_bytes": 12,
            "modified_unix_secs": 1,
            "poll_monotonic_ns": 1,
            "watch_root": "/home/alice/projects/secret_project",
            "first_poll_baseline": true,
        }),
    };
    let evs = normalize_file_lane_batch(&[dto], 1).unwrap();
    let bytes = materialize_share_safe_file_lane_pack_bytes(&evs, "fl_share").unwrap();

    validate_glass_pack_bytes_strict(&bytes).expect("strict pack validation");

    let (log, m) = SessionLog::load_from_pack_bytes_strict(&bytes).unwrap();
    assert!(m.sanitized);
    assert_eq!(
        m.export_sanitization_profile.as_deref(),
        Some("sanitize_default")
    );
    assert_eq!(
        m.sanitization_profile_version.as_deref(),
        Some("sanitize_default.1.provisional")
    );
    assert!(m
        .human_readable_redaction_summary
        .iter()
        .any(|l| l.contains("file_lane_relative_path")));
    assert!(!m.share_safe_recommended);
    assert_eq!(log.len(), 1);
    assert_eq!(
        log.events()[0].attrs["relative_path"].as_str(),
        Some("[REDACTED_REL_PATH]")
    );
    assert_eq!(
        log.events()[0].attrs["watch_root"].as_str(),
        Some("[REDACTED_ABS_PATH]")
    );
    assert_eq!(log.events()[0].actor.entity_id, "fs_poll_rel:[REDACTED]");
    let serialized = serde_json::to_string(log.events()).unwrap();
    assert!(!serialized.contains("secret_project"));
    assert!(!serialized.contains("/home/alice"));
}

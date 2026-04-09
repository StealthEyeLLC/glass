use session_engine::{
    materialize_share_safe_procfs_pack_bytes, normalize_procfs_batch,
    validate_glass_pack_bytes_strict, ProcfsRawObservationDto, SessionLog,
};

#[test]
fn procfs_dto_to_share_safe_pack_strict_loads() {
    let dto = ProcfsRawObservationDto {
        observation_seq: 1,
        session_id: "share_s".to_string(),
        ts_monotonic_ns: 42,
        raw_kind: "process_sample".to_string(),
        payload: serde_json::json!({
            "pid": 7,
            "comm": "worker",
            "exe": "/home/alice/projects/secret-app/target/debug/worker",
            "semantics": "procfs_poll_snapshot"
        }),
    };
    let evs = normalize_procfs_batch(&[dto]).unwrap();
    let bytes = materialize_share_safe_procfs_pack_bytes(&evs, "share_s").unwrap();

    validate_glass_pack_bytes_strict(&bytes).expect("strict pack validation");

    let (log, m) = SessionLog::load_from_pack_bytes_strict(&bytes).unwrap();
    assert!(m.sanitized);
    assert_eq!(
        m.export_sanitization_profile.as_deref(),
        Some("sanitize_default")
    );
    assert!(!m
        .sanitization_profile_version
        .as_deref()
        .unwrap_or("")
        .is_empty());
    assert!(!m.human_readable_redaction_summary.is_empty());
    assert!(!m.share_safe_recommended);
    assert_eq!(log.len(), 1);
    assert_eq!(
        log.events()[0].attrs["exe"].as_str(),
        Some("[REDACTED_ABS_PATH]")
    );
    let serialized = serde_json::to_string(log.events()).unwrap();
    assert!(!serialized.contains("secret-app"));
    assert!(!serialized.contains("/home/alice"));
}

use glass_collector::{
    ingest_procfs_raw_to_session_log, AdapterId, RawObservation, RawObservationKind,
    RawSourceQuality, SelfSilencePolicy,
};
use session_engine::{materialize_share_safe_procfs_pack_bytes, SessionLog};

fn raw_sample_with_exe(session: &str, exe: &str) -> RawObservation {
    RawObservation::new(
        1,
        session,
        100,
        RawObservationKind::ProcessSample,
        RawSourceQuality::ProcfsDerived,
        AdapterId::ProcfsProcess,
        serde_json::json!({
            "pid": 100,
            "comm": "demo",
            "exe": exe,
            "semantics": "procfs_poll_snapshot"
        }),
    )
}

#[test]
fn export_share_safe_pack_strict_roundtrip() {
    let raw = vec![raw_sample_with_exe(
        "exp_sess",
        "/opt/top_secret_build/demo.bin",
    )];
    let log = ingest_procfs_raw_to_session_log(raw, &SelfSilencePolicy::default()).unwrap();
    let bytes =
        materialize_share_safe_procfs_pack_bytes(log.events(), "exp_sess").expect("materialize");

    let (log2, m) = SessionLog::load_from_pack_bytes_strict(&bytes).unwrap();
    assert!(m.sanitized);
    assert_eq!(
        m.export_sanitization_profile.as_deref(),
        Some("sanitize_default")
    );
    assert!(!m.human_readable_redaction_summary.is_empty());
    assert_eq!(log2.len(), 1);
    assert_eq!(
        log2.events()[0].attrs["exe"].as_str(),
        Some("[REDACTED_ABS_PATH]")
    );
    let blob = serde_json::to_string(log2.events()).unwrap();
    assert!(!blob.contains("top_secret"));
}

use session_engine::{
    apply_sanitization_to_manifest, sanitize_events_for_share, NormalizedEventEnvelope,
    SanitizationProfile, SessionManifest,
};

#[test]
fn sanitization_merges_into_manifest() {
    let ev = NormalizedEventEnvelope::minimal_stub(1, "s", "process_start");
    let r = sanitize_events_for_share(
        &[ev],
        SanitizationProfile {
            home_dir_prefix: None,
        },
    );
    let mut m = SessionManifest::scaffold_new("s");
    apply_sanitization_to_manifest(&mut m, &r);
    assert!(m.sanitized);
    assert_eq!(
        m.export_sanitization_profile.as_deref(),
        Some("sanitize_default")
    );
    assert!(!m.human_readable_redaction_summary.is_empty());
    assert!(!m.share_safe_recommended);
}

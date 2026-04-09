use session_engine::{
    pack_artifact_lane_hint, validate_raw_dev_pack_manifest, validate_share_safe_export_manifest,
    SessionManifest,
};

fn minimal_share_safe_manifest() -> SessionManifest {
    let mut m = SessionManifest::scaffold_new("s");
    m.sanitized = true;
    m.export_sanitization_profile = Some("sanitize_default".to_string());
    m.sanitization_profile_version = Some("sanitize_default.0.provisional".to_string());
    m.human_readable_redaction_summary = vec!["rule:test -> x".to_string()];
    m
}

#[test]
fn share_safe_export_manifest_happy_path() {
    let m = minimal_share_safe_manifest();
    validate_share_safe_export_manifest(&m).unwrap();
    assert_eq!(
        pack_artifact_lane_hint(&m),
        "share_safe_export_markers_complete"
    );
}

#[test]
fn share_safe_fails_when_not_sanitized() {
    let mut m = minimal_share_safe_manifest();
    m.sanitized = false;
    assert!(validate_share_safe_export_manifest(&m).is_err());
}

#[test]
fn share_safe_fails_empty_summary() {
    let mut m = minimal_share_safe_manifest();
    m.human_readable_redaction_summary.clear();
    assert!(validate_share_safe_export_manifest(&m).is_err());
}

#[test]
fn raw_dev_rejects_sanitized_manifest() {
    let m = minimal_share_safe_manifest();
    assert!(validate_raw_dev_pack_manifest(&m).is_err());
}

#[test]
fn raw_dev_accepts_unsanitized_scaffold() {
    let m = SessionManifest::procfs_poll_dev_scaffold("p");
    validate_raw_dev_pack_manifest(&m).unwrap();
    assert_eq!(pack_artifact_lane_hint(&m), "raw_dev_or_unsanitized");
}

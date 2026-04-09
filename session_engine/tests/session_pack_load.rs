use session_engine::{
    apply_sanitization_to_manifest, sanitize_events_for_share, NormalizedEventEnvelope,
    SanitizationProfile, SessionLog, SessionManifest,
};

#[test]
fn load_roundtrip_materialize() {
    let m = SessionManifest::scaffold_new("ses_load");
    let e1 = NormalizedEventEnvelope::minimal_stub(1, "ses_load", "process_start");
    let e2 = NormalizedEventEnvelope::minimal_stub(2, "ses_load", "process_end");
    let bytes = SessionLog::from_pack_events(vec![e1.clone(), e2.clone()])
        .unwrap()
        .materialize_pack(&m)
        .unwrap();
    let (log, m2) = SessionLog::load_from_pack_bytes(&bytes).unwrap();
    assert_eq!(m2.session_id, "ses_load");
    assert_eq!(log.len(), 2);
    assert_eq!(log.events()[0].event_id, e1.event_id);
    assert_eq!(log.next_seq(), 3);
}

#[test]
fn load_sanitized_pack_fixture_flow() {
    let ev1 = NormalizedEventEnvelope::minimal_stub(1, "ses_s", "network_connect_attempt");
    let ev2 = NormalizedEventEnvelope::minimal_stub(2, "ses_s", "network_connect_result");
    let r = sanitize_events_for_share(
        &[ev1, ev2],
        SanitizationProfile {
            home_dir_prefix: None,
        },
    );
    let mut m = SessionManifest::scaffold_new("ses_s");
    apply_sanitization_to_manifest(&mut m, &r);
    let log = SessionLog::from_pack_events(r.events).unwrap();
    let bytes = log.materialize_pack(&m).unwrap();
    let (log2, m2) = SessionLog::load_from_pack_bytes(&bytes).unwrap();
    assert!(m2.sanitized);
    assert!(!m2.human_readable_redaction_summary.is_empty());
    assert_eq!(log2.len(), 2);
}

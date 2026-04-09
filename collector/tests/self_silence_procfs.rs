use glass_collector::{
    filter_for_normalization_input, AdapterId, GlassComponent, LineageIdentity, RawObservation,
    RawObservationKind, RawSourceQuality, SelfSilencePolicy,
};

#[test]
fn self_silence_applies_to_procfs_sample_payload() {
    let policy = SelfSilencePolicy {
        entries: vec![LineageIdentity {
            component: GlassComponent::Collector,
            pid: Some(4242),
            binary_basename_hint: None,
        }],
    };
    let obs = vec![RawObservation::new(
        1,
        "s",
        1,
        RawObservationKind::ProcessSample,
        RawSourceQuality::ProcfsDerived,
        AdapterId::ProcfsProcess,
        serde_json::json!({"pid": 4242, "semantics": "procfs_poll_snapshot"}),
    )];
    let (kept, st) = filter_for_normalization_input(obs, &policy);
    assert!(kept.is_empty());
    assert_eq!(st.silence.suppressed_before_normalize, 1);
}

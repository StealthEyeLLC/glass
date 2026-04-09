use glass_collector::{
    filter_for_normalization_input, LineageIdentity, RawObservation, RawObservationKind,
    RawSourceQuality, SelfSilencePolicy,
};
use glass_collector::{AdapterId, GlassComponent};

#[test]
fn suppresses_matching_pid_before_normalize() {
    let policy = SelfSilencePolicy {
        entries: vec![LineageIdentity {
            component: GlassComponent::Collector,
            pid: Some(999),
            binary_basename_hint: None,
        }],
    };
    let obs = vec![RawObservation::new(
        1,
        "s",
        1,
        RawObservationKind::ProcessLifecycle,
        RawSourceQuality::ProcfsDerived,
        AdapterId::ProcfsProcess,
        serde_json::json!({ "pid": 999 }),
    )];
    let (kept, stats) = filter_for_normalization_input(obs, &policy);
    assert!(kept.is_empty());
    assert_eq!(stats.silence.suppressed_before_normalize, 1);
    assert_eq!(stats.silence.raw_observations_examined, 1);
}

#[test]
fn suppresses_matching_comm() {
    let policy = SelfSilencePolicy {
        entries: vec![LineageIdentity {
            component: GlassComponent::Bridge,
            pid: None,
            binary_basename_hint: Some("glass-bridge".to_string()),
        }],
    };
    let obs = vec![RawObservation::new(
        1,
        "s",
        1,
        RawObservationKind::ProcessLifecycle,
        RawSourceQuality::ProcfsDerived,
        AdapterId::ProcfsProcess,
        serde_json::json!({ "comm": "glass-bridge" }),
    )];
    let (kept, _) = filter_for_normalization_input(obs, &policy);
    assert!(kept.is_empty());
}

#[test]
fn forwards_unmatched_observations() {
    let policy = SelfSilencePolicy::default();
    let obs = vec![RawObservation::new(
        1,
        "s",
        1,
        RawObservationKind::Other("x".into()),
        RawSourceQuality::Unspecified,
        AdapterId::ProcfsProcess,
        serde_json::json!({ "pid": 1 }),
    )];
    let (kept, stats) = filter_for_normalization_input(obs, &policy);
    assert_eq!(kept.len(), 1);
    assert_eq!(stats.forwarded_to_normalize, 1);
    assert_eq!(stats.silence.suppressed_before_normalize, 0);
}

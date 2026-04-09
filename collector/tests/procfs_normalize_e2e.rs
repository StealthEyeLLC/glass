use glass_collector::{
    ingest_procfs_raw_to_session_log, AdapterId, GlassComponent, LineageIdentity, RawObservation,
    RawObservationKind, RawSourceQuality, SelfSilencePolicy,
};
use session_engine::{validate_event_kind_strict, SessionLog, SessionManifest};

fn sample_raw(pid: u32, seq: u64) -> RawObservation {
    RawObservation::new(
        seq,
        "e2e_sess",
        seq * 100,
        RawObservationKind::ProcessSample,
        RawSourceQuality::ProcfsDerived,
        AdapterId::ProcfsProcess,
        serde_json::json!({
            "semantics": "procfs_poll_snapshot",
            "pid": pid,
            "comm": "fixture",
            "ppid": 1,
        }),
    )
}

#[test]
fn ingest_builds_session_and_strict_pack_loads() {
    let raw = vec![sample_raw(1001, 1), sample_raw(1002, 2)];
    let log = ingest_procfs_raw_to_session_log(raw, &SelfSilencePolicy::default()).unwrap();
    assert_eq!(log.len(), 2);
    assert_eq!(log.events()[0].kind, "process_poll_sample");
    validate_event_kind_strict(&log.events()[0].kind).unwrap();

    let manifest = SessionManifest::procfs_poll_dev_scaffold("e2e_sess");
    let bytes = log.materialize_pack(&manifest).unwrap();
    let (log2, _) = SessionLog::load_from_pack_bytes_strict(&bytes).unwrap();
    assert_eq!(log2.len(), 2);
}

#[test]
fn self_silence_drops_before_normalize() {
    let policy = SelfSilencePolicy {
        entries: vec![LineageIdentity {
            component: GlassComponent::Collector,
            pid: Some(1001),
            binary_basename_hint: None,
        }],
    };
    let raw = vec![sample_raw(1001, 1)];
    let log = ingest_procfs_raw_to_session_log(raw, &policy).unwrap();
    assert!(log.is_empty());
}

#[test]
fn non_procfs_raw_kinds_ignored_in_ingest() {
    let raw = vec![RawObservation::new(
        1,
        "e2e_sess",
        0,
        RawObservationKind::ProcessLifecycle,
        RawSourceQuality::ProcfsDerived,
        AdapterId::ProcfsProcess,
        serde_json::json!({"pid": 1}),
    )];
    let log = ingest_procfs_raw_to_session_log(raw, &SelfSilencePolicy::default()).unwrap();
    assert!(log.is_empty());
}

#[test]
fn raw_json_roundtrip_then_ingest() {
    let o = RawObservation::new(
        1,
        "json_sess",
        10,
        RawObservationKind::ProcessSeenInPollGap,
        RawSourceQuality::ProcfsDerived,
        AdapterId::ProcfsProcess,
        serde_json::json!({"pid": 3, "semantics": "procfs_poll_delta", "honesty": "test"}),
    );
    let j = serde_json::to_string(&vec![o]).unwrap();
    let observations: Vec<RawObservation> = serde_json::from_str(&j).unwrap();
    let log =
        ingest_procfs_raw_to_session_log(observations, &SelfSilencePolicy::default()).unwrap();
    assert_eq!(log.len(), 1);
    assert_eq!(log.events()[0].kind, "process_seen_in_poll_gap");
}

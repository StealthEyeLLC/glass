use session_engine::{
    normalize_procfs_batch, normalize_procfs_observation, validate_event_kind_strict,
    validate_normalized_event, ProcfsNormalizeError, ProcfsRawObservationDto, SessionLog,
    SessionManifest,
};

#[test]
fn sample_maps_to_process_poll_sample() {
    let dto = ProcfsRawObservationDto {
        observation_seq: 7,
        session_id: "s".to_string(),
        ts_monotonic_ns: 999,
        raw_kind: "process_sample".to_string(),
        payload: serde_json::json!({
            "pid": 42,
            "ppid": 1,
            "comm": "foo",
            "semantics": "procfs_poll_snapshot",
        }),
    };
    let ev = normalize_procfs_observation(&dto, 1).unwrap();
    assert_eq!(ev.kind, "process_poll_sample");
    assert_eq!(ev.seq, 1);
    assert_eq!(ev.ts_ns, 999);
    assert!(ev.actor.entity_id.contains("procfs_pid:42"));
    assert!(ev
        .parent
        .as_ref()
        .is_some_and(|p| p.entity_id.contains("procfs_pid:1")));
    assert_eq!(ev.source["kernel_spawn_exit_atomic_truth"], false);
    assert_eq!(ev.source["inference_level"], "poll_snapshot");
    validate_normalized_event(&ev).unwrap();
    validate_event_kind_strict(&ev.kind).unwrap();
}

#[test]
fn poll_gap_kinds_and_inference() {
    let seen = ProcfsRawObservationDto {
        observation_seq: 1,
        session_id: "s".to_string(),
        ts_monotonic_ns: 1,
        raw_kind: "process_seen_in_poll_gap".to_string(),
        payload: serde_json::json!({"pid": 5, "honesty": "x"}),
    };
    let ev = normalize_procfs_observation(&seen, 1).unwrap();
    assert_eq!(ev.kind, "process_seen_in_poll_gap");
    assert_eq!(ev.source["inference_level"], "poll_gap_delta");
    validate_event_kind_strict(&ev.kind).unwrap();

    let absent = ProcfsRawObservationDto {
        observation_seq: 2,
        session_id: "s".to_string(),
        ts_monotonic_ns: 2,
        raw_kind: "process_absent_in_poll_gap".to_string(),
        payload: serde_json::json!({"pid": 5}),
    };
    let ev2 = normalize_procfs_observation(&absent, 2).unwrap();
    assert_eq!(ev2.kind, "process_absent_in_poll_gap");
    validate_event_kind_strict(&ev2.kind).unwrap();
}

#[test]
fn rejects_unknown_raw_kind() {
    let dto = ProcfsRawObservationDto {
        observation_seq: 1,
        session_id: "s".to_string(),
        ts_monotonic_ns: 0,
        raw_kind: "process_spawn".to_string(),
        payload: serde_json::json!({"pid": 1}),
    };
    assert_eq!(
        normalize_procfs_observation(&dto, 1),
        Err(ProcfsNormalizeError::UnknownRawKind(
            "process_spawn".to_string()
        ))
    );
}

#[test]
fn rejects_non_object_payload() {
    let dto = ProcfsRawObservationDto {
        observation_seq: 1,
        session_id: "s".to_string(),
        ts_monotonic_ns: 0,
        raw_kind: "process_sample".to_string(),
        payload: serde_json::json!([]),
    };
    assert_eq!(
        normalize_procfs_observation(&dto, 1),
        Err(ProcfsNormalizeError::BadPayload)
    );
}

#[test]
fn batch_orders_seq() {
    let dtos = vec![
        ProcfsRawObservationDto {
            observation_seq: 10,
            session_id: "s".to_string(),
            ts_monotonic_ns: 1,
            raw_kind: "process_sample".to_string(),
            payload: serde_json::json!({"pid": 1, "comm": "a"}),
        },
        ProcfsRawObservationDto {
            observation_seq: 11,
            session_id: "s".to_string(),
            ts_monotonic_ns: 2,
            raw_kind: "process_sample".to_string(),
            payload: serde_json::json!({"pid": 2, "comm": "b"}),
        },
    ];
    let evs = normalize_procfs_batch(&dtos).unwrap();
    assert_eq!(evs.len(), 2);
    assert_eq!(evs[0].seq, 1);
    assert_eq!(evs[1].seq, 2);
}

#[test]
fn session_append_and_strict_pack_roundtrip() {
    let dto = ProcfsRawObservationDto {
        observation_seq: 1,
        session_id: "sess_a".to_string(),
        ts_monotonic_ns: 100,
        raw_kind: "process_sample".to_string(),
        payload: serde_json::json!({"pid": 99, "comm": "x"}),
    };
    let mut log = SessionLog::new();
    log.append_procfs_dtos(&[dto]).unwrap();
    assert_eq!(log.len(), 1);

    let manifest = SessionManifest::procfs_poll_dev_scaffold("sess_a");
    let bytes = log.materialize_pack(&manifest).unwrap();
    let (_log2, m2) = SessionLog::load_from_pack_bytes_strict(&bytes).unwrap();
    assert_eq!(m2.session_id, "sess_a");
}

use session_engine::{
    normalize_file_lane_observation, validate_event_kind_strict, FileLaneRawObservationDto,
};

#[test]
fn snapshot_maps_to_file_poll_snapshot() {
    let dto = FileLaneRawObservationDto {
        observation_seq: 1,
        session_id: "s".into(),
        ts_monotonic_ns: 9,
        raw_kind: "file_seen_in_poll_snapshot".into(),
        payload: serde_json::json!({
            "semantics": "bounded_directory_poll_snapshot",
            "relative_path": "a/b.txt",
            "size_bytes": 3,
            "modified_unix_secs": 1,
            "poll_monotonic_ns": 9,
            "scan": { "files_seen_total": 1, "samples_returned": 1, "truncated_by_sample_budget": false, "state_budget_truncated": false, "max_depth": 4 },
            "watch_root": "/tmp/w",
            "first_poll_baseline": true,
        }),
    };
    let ev = normalize_file_lane_observation(&dto, 1).expect("normalize");
    assert_eq!(ev.kind, "file_poll_snapshot");
    assert!(validate_event_kind_strict(&ev.kind).is_ok());
    assert_eq!(ev.actor.entity_type, "file");
    assert!(ev.actor.entity_id.starts_with("fs_poll_rel:"));
}

#[test]
fn created_gap_maps_to_file_seen_in_poll_gap() {
    let dto = FileLaneRawObservationDto {
        observation_seq: 2,
        session_id: "s".into(),
        ts_monotonic_ns: 10,
        raw_kind: "file_created_in_poll_gap".into(),
        payload: serde_json::json!({
            "semantics": "directory_poll_delta",
            "relative_path": "new.txt",
            "honesty": "appeared_since_previous_poll_not_exact_create_syscall_or_time",
            "watch_root": "/tmp/w",
            "state_budget_truncated": false,
        }),
    };
    let ev = normalize_file_lane_observation(&dto, 2).expect("normalize");
    assert_eq!(ev.kind, "file_seen_in_poll_gap");
}

#[test]
fn rejects_unknown_raw_kind() {
    let dto = FileLaneRawObservationDto {
        observation_seq: 1,
        session_id: "s".into(),
        ts_monotonic_ns: 0,
        raw_kind: "file_syscall_read".into(),
        payload: serde_json::json!({ "relative_path": "x" }),
    };
    assert!(normalize_file_lane_observation(&dto, 1).is_err());
}

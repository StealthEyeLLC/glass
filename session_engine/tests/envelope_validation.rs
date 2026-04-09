use session_engine::{
    validate_event_kind_strict, validate_normalized_event, EntityRef, NormalizedEventEnvelope,
};

fn sample_valid() -> NormalizedEventEnvelope {
    NormalizedEventEnvelope::minimal_stub(1, "s", "process_start")
}

#[test]
fn rejects_wrong_schema_version() {
    let mut e = sample_valid();
    e.schema_version = "glass.event.v99".to_string();
    assert!(validate_normalized_event(&e).is_err());
}

#[test]
fn rejects_empty_actor_id() {
    let mut e = sample_valid();
    e.actor.entity_id = "".to_string();
    assert!(validate_normalized_event(&e).is_err());
}

#[test]
fn rejects_non_object_attrs() {
    let mut e = sample_valid();
    e.attrs = serde_json::json!([]);
    assert!(validate_normalized_event(&e).is_err());
}

#[test]
fn strict_kind_rejects_unknown() {
    assert!(validate_event_kind_strict("bogus").is_err());
    assert!(validate_event_kind_strict("file_read").is_ok());
    assert!(validate_event_kind_strict("process_poll_sample").is_ok());
    assert!(validate_event_kind_strict("process_seen_in_poll_gap").is_ok());
    assert!(validate_event_kind_strict("process_absent_in_poll_gap").is_ok());
}

#[test]
fn accepts_optional_subject() {
    let mut e = sample_valid();
    e.subject = Some(EntityRef {
        entity_type: "file".to_string(),
        entity_id: "f1".to_string(),
        resolution_quality: None,
    });
    validate_normalized_event(&e).unwrap();
}

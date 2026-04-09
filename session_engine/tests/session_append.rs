use session_engine::{NormalizedEventEnvelope, SessionLog};

#[test]
fn append_requires_monotonic_seq() {
    let mut log = SessionLog::new();
    let e1 = NormalizedEventEnvelope::minimal_stub(1, "s", "a");
    log.append(e1).unwrap();
    let bad = NormalizedEventEnvelope::minimal_stub(3, "s", "b");
    assert!(log.append(bad).is_err());
}

#[test]
fn push_fresh_assigns_seq() {
    let mut log = SessionLog::new();
    let mut a = NormalizedEventEnvelope::minimal_stub(99, "s", "a");
    log.push_fresh(a.clone()).unwrap();
    a.kind = "b".to_string();
    log.push_fresh(a).unwrap();
    assert_eq!(log.events()[0].seq, 1);
    assert_eq!(log.events()[1].seq, 2);
}

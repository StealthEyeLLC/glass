use graph_engine::count_process_entities;
use session_engine::NormalizedEventEnvelope;

#[test]
fn counts_process_actors() {
    let e = NormalizedEventEnvelope::minimal_stub(1, "s", "process_start");
    assert_eq!(count_process_entities(&[e]), 1);
}

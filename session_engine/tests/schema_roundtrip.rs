use std::fs;
use std::path::Path;

use session_engine::NormalizedEventEnvelope;

#[test]
fn example_event_json_roundtrips() {
    let p = Path::new(env!("CARGO_MANIFEST_DIR")).join("../schema/examples/minimal_event.json");
    let raw = fs::read_to_string(p).unwrap();
    let e: NormalizedEventEnvelope = serde_json::from_str(&raw).unwrap();
    let again = serde_json::to_string(&e).unwrap();
    let e2: NormalizedEventEnvelope = serde_json::from_str(&again).unwrap();
    assert_eq!(e.event_id, e2.event_id);
    assert_eq!(e.schema_version, "glass.event.v0");
}

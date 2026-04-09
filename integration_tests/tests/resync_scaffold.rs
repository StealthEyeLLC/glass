//! Resync contract reachable from integration layer (bridge crate owns types).

#[test]
fn bridge_resync_exports_threshold() {
    let t = glass_bridge::resync::PROVISIONAL_BACKLOG_EVENT_THRESHOLD;
    assert!(t > 0);
}

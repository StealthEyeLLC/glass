use glass_bridge::resync::{
    expected_recovery, ViewerRecoveryStrategy, PROVISIONAL_BACKLOG_EVENT_THRESHOLD,
};

#[test]
fn backlog_threshold_is_positive_provisional() {
    let t = PROVISIONAL_BACKLOG_EVENT_THRESHOLD;
    assert_ne!(t, 0);
}

#[test]
fn recovery_is_snapshot_and_cursor() {
    assert!(matches!(
        expected_recovery(),
        ViewerRecoveryStrategy::SnapshotAndCursor
    ));
}

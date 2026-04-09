//! Proves **raw** collector types are distinct from `session_engine` normalized envelopes (no accidental collapse).

use glass_collector::{AdapterId, RawObservation, RawObservationKind, RawSourceQuality};
use session_engine::NormalizedEventEnvelope;

#[test]
fn types_are_distinct_in_memory() {
    let raw = RawObservation::new(
        1,
        "ses",
        0,
        RawObservationKind::FilePathAccess,
        RawSourceQuality::Unspecified,
        AdapterId::FsFileLane,
        serde_json::json!({ "path": "/tmp/x" }),
    );
    let norm = NormalizedEventEnvelope::minimal_stub(1, "ses", "file_read");
    let _tuple: (RawObservation, NormalizedEventEnvelope) = (raw, norm);
}

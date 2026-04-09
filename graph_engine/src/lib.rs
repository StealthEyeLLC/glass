//! Graph engine: derives graph-ready structures from session events.
//!
//! **Boundary:** consumes `session_engine` facts only. No WebGPU, no HTTP bridge, no host sensors.

use session_engine::NormalizedEventEnvelope;

/// Placeholder graph node id (real layout/graph build lands in Phase 4).
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct GraphNodeId(pub String);

/// Count processes mentioned in events (minimal integrity check for scaffolding).
pub fn count_process_entities(events: &[NormalizedEventEnvelope]) -> usize {
    let mut n = 0;
    for e in events {
        if e.actor.entity_type == "process" {
            n += 1;
        }
    }
    n
}

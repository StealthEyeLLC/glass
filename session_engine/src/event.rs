use serde::{Deserialize, Serialize};

/// Reference to an entity in the normalized model (spec §12.2 / envelope §12.4).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EntityRef {
    pub entity_type: String,
    pub entity_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resolution_quality: Option<String>,
}

/// Canonical normalized event envelope (spec §12.4). `attrs` / `source` must be JSON objects for pack validation.
/// Use [`crate::validate::validate_normalized_event`] before trusting untrusted pack bytes.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NormalizedEventEnvelope {
    pub schema_version: String,
    pub event_id: String,
    pub session_id: String,
    pub ts_ns: u64,
    pub seq: u64,
    pub kind: String,
    pub actor: EntityRef,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject: Option<EntityRef>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent: Option<EntityRef>,
    pub attrs: serde_json::Value,
    pub source: serde_json::Value,
}

impl NormalizedEventEnvelope {
    pub fn minimal_stub(seq: u64, session_id: &str, kind: &str) -> Self {
        Self {
            schema_version: "glass.event.v0".to_string(),
            event_id: format!("evt_{seq:012}"),
            session_id: session_id.to_string(),
            ts_ns: seq,
            seq,
            kind: kind.to_string(),
            actor: EntityRef {
                entity_type: "process".to_string(),
                entity_id: "proc_stub".to_string(),
                resolution_quality: Some("direct".to_string()),
            },
            subject: None,
            parent: None,
            attrs: serde_json::json!({}),
            source: serde_json::json!({
                "adapter": "scaffold",
                "quality": "direct",
                "time_domain": "session_monotonic",
            }),
        }
    }
}

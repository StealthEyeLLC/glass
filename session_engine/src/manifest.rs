use serde::{Deserialize, Serialize};

/// Tier B static replay default: ZIP + `manifest.json` + `events.jsonl` (viewer-compatible).
pub const PACK_FORMAT_SCAFFOLD_V0: &str = "glass.pack.v0.scaffold";

/// Same ZIP layout with `events.seg` (length-prefixed JSON records) instead of JSONL — **Rust / tooling**; Tier B viewer still expects [`PACK_FORMAT_SCAFFOLD_V0`].
pub const PACK_FORMAT_SCAFFOLD_SEG_V0: &str = "glass.pack.v0.scaffold_seg";

/// Session / pack manifest (spec §14.3 subset + forward-compatible optional fields).
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SessionManifest {
    pub pack_format_version: String,
    pub session_id: String,
    pub capture_mode: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fidelity_tier: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_adapter_id: Option<String>,

    /// `none` | `sanitize_default` | custom label (spec §14.3).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub export_sanitization_profile: Option<String>,

    pub sanitized: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sanitization_profile_version: Option<String>,
    /// Human-readable lines; must be trustworthy for public sharing (build plan).
    #[serde(default)]
    pub human_readable_redaction_summary: Vec<String>,

    pub share_safe_recommended: bool,

    /// `Some("events.jsonl")` for [`PACK_FORMAT_SCAFFOLD_V0`], `Some("events.seg")` for [`PACK_FORMAT_SCAFFOLD_SEG_V0`].
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub events_blob: Option<String>,

    // --- Spec §14.3 optional capture / export metadata (serde round-trip safe) ---
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_root: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_storage_ceiling_bytes: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active_event_ceiling: Option<u64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub zone_hydration_performed: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resource_heartbeat_enabled: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_path_masked_or_hashed: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub argv_values_stripped_on_export: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub private_network_endpoints_masked: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub local_domain_or_socket_masked: Option<bool>,
}

impl SessionManifest {
    pub fn scaffold_new(session_id: &str) -> Self {
        Self {
            pack_format_version: PACK_FORMAT_SCAFFOLD_V0.to_string(),
            session_id: session_id.to_string(),
            capture_mode: "replay".to_string(),
            fidelity_tier: None,
            active_adapter_id: None,
            export_sanitization_profile: None,
            sanitized: false,
            sanitization_profile_version: None,
            human_readable_redaction_summary: vec![],
            share_safe_recommended: false,
            events_blob: Some("events.jsonl".to_string()),
            target_root: None,
            active_storage_ceiling_bytes: None,
            active_event_ceiling: None,
            zone_hydration_performed: None,
            resource_heartbeat_enabled: None,
            user_path_masked_or_hashed: None,
            argv_values_stripped_on_export: None,
            private_network_endpoints_masked: None,
            local_domain_or_socket_masked: None,
        }
    }

    /// Dev / tooling manifest for one-shot procfs poll → pack (not full product capture).
    pub fn procfs_poll_dev_scaffold(session_id: &str) -> Self {
        let mut m = Self::scaffold_new(session_id);
        m.capture_mode = "procfs_poll_dev".to_string();
        m.active_adapter_id = Some("procfs_process".to_string());
        m.fidelity_tier = Some("fallback_reduced".to_string());
        m
    }

    /// Dev / tooling manifest for one-shot **directory-poll file lane** → pack (unsanitized normalize path).
    pub fn file_lane_poll_dev_scaffold(session_id: &str) -> Self {
        let mut m = Self::scaffold_new(session_id);
        m.capture_mode = "directory_poll_dev".to_string();
        m.active_adapter_id = Some("fs_file_lane".to_string());
        m.fidelity_tier = Some("fallback_reduced".to_string());
        m
    }

    pub fn scaffold_seg_new(session_id: &str) -> Self {
        Self {
            pack_format_version: PACK_FORMAT_SCAFFOLD_SEG_V0.to_string(),
            session_id: session_id.to_string(),
            capture_mode: "replay".to_string(),
            fidelity_tier: None,
            active_adapter_id: None,
            export_sanitization_profile: None,
            sanitized: false,
            sanitization_profile_version: None,
            human_readable_redaction_summary: vec![],
            share_safe_recommended: false,
            events_blob: Some("events.seg".to_string()),
            target_root: None,
            active_storage_ceiling_bytes: None,
            active_event_ceiling: None,
            zone_hydration_performed: None,
            resource_heartbeat_enabled: None,
            user_path_masked_or_hashed: None,
            argv_values_stripped_on_export: None,
            private_network_endpoints_masked: None,
            local_domain_or_socket_masked: None,
        }
    }
}

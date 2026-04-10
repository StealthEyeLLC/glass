//! Honest normalization: **directory-poll** file lane raw DTOs → [`NormalizedEventEnvelope`].
//!
//! **Semantics:** bounded root + polling only — never syscall-level `file_read` / `file_write` truth.

use thiserror::Error;

use crate::event::{EntityRef, NormalizedEventEnvelope};
use crate::validate::CANONICAL_EVENT_SCHEMA_VERSION;

/// Input mirroring `glass_collector::raw::RawObservation` fs file lane rows — **no** dependency on the collector crate.
#[derive(Debug, Clone, PartialEq)]
pub struct FileLaneRawObservationDto {
    pub observation_seq: u64,
    pub session_id: String,
    pub ts_monotonic_ns: u64,
    /// `file_seen_in_poll_snapshot` | `file_changed_between_polls` | `file_missing_in_poll_gap` | `file_created_in_poll_gap`
    pub raw_kind: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum FileLaneNormalizeError {
    #[error("unknown file lane raw kind: {0}")]
    UnknownRawKind(String),
    #[error("payload must include string relative_path")]
    MissingRelativePath,
    #[error("payload must be a JSON object for attrs extraction")]
    BadPayload,
}

pub const FS_POLL_FILE_ENTITY_PREFIX: &str = "fs_poll_rel:";
pub const RESOLUTION_FS_POLL_REL_PATH: &str =
    "declared_root_relative_path_directory_poll_not_kernel_inode_identity";

fn rel_path_from_payload(payload: &serde_json::Value) -> Option<String> {
    payload
        .get("relative_path")
        .and_then(|v| v.as_str())
        .map(str::to_string)
}

fn file_entity(rel: &str) -> EntityRef {
    let safe: String = rel
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '/' || c == '.' || c == '_' || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    EntityRef {
        entity_type: "file".to_string(),
        entity_id: format!("{FS_POLL_FILE_ENTITY_PREFIX}{safe}"),
        resolution_quality: Some(RESOLUTION_FS_POLL_REL_PATH.to_string()),
    }
}

fn base_attrs_snapshot(payload: &serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "semantics": payload.get("semantics"),
        "not_syscall_file_access": true,
        "relative_path": payload.get("relative_path"),
        "size_bytes": payload.get("size_bytes"),
        "modified_unix_secs": payload.get("modified_unix_secs"),
        "poll_monotonic_ns": payload.get("poll_monotonic_ns"),
        "scan": payload.get("scan"),
        "watch_root": payload.get("watch_root"),
        "first_poll_baseline": payload.get("first_poll_baseline"),
        "inference_level": "poll_snapshot",
    })
}

fn base_attrs_delta(payload: &serde_json::Value, honesty_key: &str) -> serde_json::Value {
    serde_json::json!({
        "semantics": payload.get("semantics"),
        "relative_path": payload.get("relative_path"),
        "honesty": payload.get("honesty"),
        "watch_root": payload.get("watch_root"),
        "state_budget_truncated": payload.get("state_budget_truncated"),
        "size_bytes": payload.get("size_bytes"),
        "modified_unix_secs": payload.get("modified_unix_secs"),
        "inference_level": honesty_key,
    })
}

fn normalized_kind(raw_kind: &str) -> Result<&'static str, FileLaneNormalizeError> {
    match raw_kind {
        "file_seen_in_poll_snapshot" => Ok("file_poll_snapshot"),
        "file_changed_between_polls" => Ok("file_changed_between_polls"),
        "file_missing_in_poll_gap" => Ok("file_absent_in_poll_gap"),
        "file_created_in_poll_gap" => Ok("file_seen_in_poll_gap"),
        other => Err(FileLaneNormalizeError::UnknownRawKind(other.to_string())),
    }
}

fn inference_for_source(raw_kind: &str) -> &'static str {
    match raw_kind {
        "file_seen_in_poll_snapshot" => "poll_snapshot",
        "file_changed_between_polls" | "file_missing_in_poll_gap" | "file_created_in_poll_gap" => {
            "poll_gap_delta"
        }
        _ => "unknown",
    }
}

/// Map one file-lane raw DTO to a normalized envelope. Caller assigns `seq` via [`crate::SessionLog::push_fresh`].
pub fn normalize_file_lane_observation(
    dto: &FileLaneRawObservationDto,
    session_seq: u64,
) -> Result<NormalizedEventEnvelope, FileLaneNormalizeError> {
    if !dto.payload.is_object() {
        return Err(FileLaneNormalizeError::BadPayload);
    }

    let kind = normalized_kind(dto.raw_kind.as_str())?;
    let rel =
        rel_path_from_payload(&dto.payload).ok_or(FileLaneNormalizeError::MissingRelativePath)?;
    let actor = file_entity(&rel);

    let attrs = match dto.raw_kind.as_str() {
        "file_seen_in_poll_snapshot" => base_attrs_snapshot(&dto.payload),
        "file_changed_between_polls" => {
            base_attrs_delta(&dto.payload, "poll_gap_delta_metadata_change")
        }
        "file_missing_in_poll_gap" => base_attrs_delta(&dto.payload, "poll_gap_delta_absent"),
        "file_created_in_poll_gap" => base_attrs_delta(&dto.payload, "poll_gap_delta_appeared"),
        _ => {
            return Err(FileLaneNormalizeError::UnknownRawKind(dto.raw_kind.clone()));
        }
    };

    let source = serde_json::json!({
        "adapter": "fs_file_lane",
        "quality": "directory_poll_derived",
        "time_domain": "collector_monotonic_ns",
        "inference_level": inference_for_source(dto.raw_kind.as_str()),
        "raw_observation_seq": dto.observation_seq,
        "kernel_syscall_file_io_atomic_truth": false,
    });

    Ok(NormalizedEventEnvelope {
        schema_version: CANONICAL_EVENT_SCHEMA_VERSION.to_string(),
        event_id: format!("evt_fs_lane_{:012}_r{}", session_seq, dto.observation_seq),
        session_id: dto.session_id.clone(),
        ts_ns: dto.ts_monotonic_ns,
        seq: session_seq,
        kind: kind.to_string(),
        actor,
        subject: None,
        parent: None,
        attrs,
        source,
    })
}

/// Ordered batch map (preserves DTO order).
pub fn normalize_file_lane_batch(
    dtos: &[FileLaneRawObservationDto],
    mut next_seq: u64,
) -> Result<Vec<NormalizedEventEnvelope>, FileLaneNormalizeError> {
    let mut out = Vec::with_capacity(dtos.len());
    for dto in dtos {
        out.push(normalize_file_lane_observation(dto, next_seq)?);
        next_seq += 1;
    }
    Ok(out)
}

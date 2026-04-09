//! Honest normalization: procfs **raw** observation DTOs → [`NormalizedEventEnvelope`].
//!
//! **Semantics:** polling / snapshot only — never `process_start` / `process_end` kernel truth.
//! **Identity:** Linux PID is **ephemeral**; same numeric PID may denote different processes over time.

use thiserror::Error;

use crate::event::{EntityRef, NormalizedEventEnvelope};
use crate::validate::CANONICAL_EVENT_SCHEMA_VERSION;

/// Input mirroring `glass_collector::raw::RawObservation` procfs rows — **no** dependency on the collector crate.
#[derive(Debug, Clone, PartialEq)]
pub struct ProcfsRawObservationDto {
    pub observation_seq: u64,
    pub session_id: String,
    pub ts_monotonic_ns: u64,
    /// `process_sample` | `process_seen_in_poll_gap` | `process_absent_in_poll_gap`
    pub raw_kind: String,
    pub payload: serde_json::Value,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum ProcfsNormalizeError {
    #[error("unknown procfs raw kind: {0}")]
    UnknownRawKind(String),
    #[error("payload must include integer pid")]
    MissingPid,
    #[error("payload must be a JSON object for attrs extraction")]
    BadPayload,
}

/// Stable `entity_id` prefix for procfs-derived process actors (not a global stable identity).
pub const PROCFS_PROCESS_ENTITY_PREFIX: &str = "procfs_pid:";

/// `resolution_quality` for PID-only procfs identity (spec-aligned free string).
pub const RESOLUTION_PID_EPHEMERAL_POLL: &str = "linux_pid_ephemeral_procfs_poll";

fn pid_from_payload(payload: &serde_json::Value) -> Option<u64> {
    payload
        .get("pid")
        .and_then(|v| v.as_u64().or_else(|| v.as_i64().map(|i| i.max(0) as u64)))
}

fn process_actor_entity(payload: &serde_json::Value) -> Result<EntityRef, ProcfsNormalizeError> {
    let pid = pid_from_payload(payload).ok_or(ProcfsNormalizeError::MissingPid)?;
    let start = payload
        .get("starttime_kernel_ticks")
        .and_then(|v| v.as_u64().or_else(|| v.as_i64().map(|i| i.max(0) as u64)));
    let comm = payload.get("comm").and_then(|v| v.as_str()).unwrap_or("");

    let mut entity_id = format!("{PROCFS_PROCESS_ENTITY_PREFIX}{pid}");
    if let Some(st) = start {
        entity_id.push_str(&format!(";st:{st}"));
    }
    if !comm.is_empty() {
        entity_id.push_str(";hint:");
        entity_id.push_str(
            &comm
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '_')
                .take(32)
                .collect::<String>(),
        );
    }

    Ok(EntityRef {
        entity_type: "process".to_string(),
        entity_id,
        resolution_quality: Some(RESOLUTION_PID_EPHEMERAL_POLL.to_string()),
    })
}

fn optional_parent_entity(payload: &serde_json::Value) -> Option<EntityRef> {
    let ppid = payload.get("ppid")?;
    let ppid = ppid
        .as_u64()
        .or_else(|| ppid.as_i64().map(|i| i.max(0) as u64))?;
    Some(EntityRef {
        entity_type: "process".to_string(),
        entity_id: format!("{PROCFS_PROCESS_ENTITY_PREFIX}{ppid}"),
        resolution_quality: Some(RESOLUTION_PID_EPHEMERAL_POLL.to_string()),
    })
}

fn base_attrs_for_sample(payload: &serde_json::Value) -> serde_json::Value {
    serde_json::json!({
        "semantics": "procfs_poll_snapshot",
        "not_kernel_lifecycle_event": true,
        "identity_guarantee": "linux_numeric_pid_scope_ephemeral",
        "pid_reuse_warning": "same_pid_may_denote_different_processes_over_time_or_after_reuse",
        "pid": payload.get("pid"),
        "ppid": payload.get("ppid"),
        "comm": payload.get("comm"),
        "exe": payload.get("exe"),
        "exe_note": payload.get("exe_note"),
        "starttime_kernel_ticks": payload.get("starttime_kernel_ticks"),
        "poll_monotonic_ns": payload.get("poll_monotonic_ns"),
        "scan": payload.get("scan"),
    })
}

fn base_attrs_poll_gap(payload: &serde_json::Value, semantics: &str) -> serde_json::Value {
    serde_json::json!({
        "semantics": semantics,
        "not_kernel_lifecycle_event": true,
        "identity_guarantee": "linux_numeric_pid_scope_ephemeral",
        "pid_reuse_warning": "same_pid_may_denote_different_processes_over_time_or_after_reuse",
        "pid": payload.get("pid"),
        "honesty": payload.get("honesty"),
    })
}

fn inference_level(raw_kind: &str) -> &'static str {
    match raw_kind {
        "process_sample" => "poll_snapshot",
        "process_seen_in_poll_gap" | "process_absent_in_poll_gap" => "poll_gap_delta",
        _ => "unknown",
    }
}

fn normalized_kind(raw_kind: &str) -> Result<&'static str, ProcfsNormalizeError> {
    match raw_kind {
        "process_sample" => Ok("process_poll_sample"),
        "process_seen_in_poll_gap" => Ok("process_seen_in_poll_gap"),
        "process_absent_in_poll_gap" => Ok("process_absent_in_poll_gap"),
        other => Err(ProcfsNormalizeError::UnknownRawKind(other.to_string())),
    }
}

/// Map one procfs raw DTO to a normalized envelope. `seq` is the **session** sequence (1-based); caller assigns via [`crate::SessionLog::push_fresh`] if needed.
pub fn normalize_procfs_observation(
    dto: &ProcfsRawObservationDto,
    session_seq: u64,
) -> Result<NormalizedEventEnvelope, ProcfsNormalizeError> {
    if !dto.payload.is_object() {
        return Err(ProcfsNormalizeError::BadPayload);
    }

    let kind = normalized_kind(dto.raw_kind.as_str())?;
    let actor = process_actor_entity(&dto.payload)?;

    let (attrs, parent) = match dto.raw_kind.as_str() {
        "process_sample" => (
            base_attrs_for_sample(&dto.payload),
            optional_parent_entity(&dto.payload),
        ),
        "process_seen_in_poll_gap" => {
            (base_attrs_poll_gap(&dto.payload, "procfs_poll_delta"), None)
        }
        "process_absent_in_poll_gap" => {
            (base_attrs_poll_gap(&dto.payload, "procfs_poll_delta"), None)
        }
        _ => {
            return Err(ProcfsNormalizeError::UnknownRawKind(dto.raw_kind.clone()));
        }
    };

    let source = serde_json::json!({
        "adapter": "procfs_process",
        "quality": "procfs_derived",
        "time_domain": "collector_monotonic_ns",
        "inference_level": inference_level(dto.raw_kind.as_str()),
        "raw_observation_seq": dto.observation_seq,
        "kernel_spawn_exit_atomic_truth": false,
    });

    Ok(NormalizedEventEnvelope {
        schema_version: CANONICAL_EVENT_SCHEMA_VERSION.to_string(),
        event_id: format!("evt_procfs_{:012}_r{}", session_seq, dto.observation_seq),
        session_id: dto.session_id.clone(),
        ts_ns: dto.ts_monotonic_ns,
        seq: session_seq,
        kind: kind.to_string(),
        actor,
        subject: None,
        parent,
        attrs,
        source,
    })
}

/// Normalize an ordered slice; assigns `session_seq` 1..=n (use when building a fresh session batch).
pub fn normalize_procfs_batch(
    dtos: &[ProcfsRawObservationDto],
) -> Result<Vec<NormalizedEventEnvelope>, ProcfsNormalizeError> {
    let mut out = Vec::with_capacity(dtos.len());
    for (i, dto) in dtos.iter().enumerate() {
        let seq = (i as u64) + 1;
        out.push(normalize_procfs_observation(dto, seq)?);
    }
    Ok(out)
}

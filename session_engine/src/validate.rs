//! Envelope and pack-content validation (spec §12.4–§12.5 alignment for Phase 1).

use crate::event::NormalizedEventEnvelope;
use crate::manifest::{SessionManifest, PACK_FORMAT_SCAFFOLD_SEG_V0, PACK_FORMAT_SCAFFOLD_V0};

/// Canonical event schema version string (must match `schema/glass_event_schema.json`).
pub const CANONICAL_EVENT_SCHEMA_VERSION: &str = "glass.event.v0";

/// v0 event kinds from spec §12.5 (strict validation uses this set).
pub const KNOWN_EVENT_KINDS_V0: &[&str] = &[
    "process_start",
    "process_end",
    "process_spawn",
    "file_read",
    "file_write",
    "file_create",
    "file_delete",
    "file_rename",
    "network_connect_attempt",
    "network_connect_result",
    "ipc_connect",
    "ipc_transfer",
    "boundary_cross",
    "resource_heartbeat",
    "file_write_burst",
    "network_burst",
    "ipc_burst",
    "command_exec",
    "env_access",
    // Procfs polling — **not** kernel spawn/exit (see `procfs_normalize`).
    "process_poll_sample",
    "process_seen_in_poll_gap",
    "process_absent_in_poll_gap",
    // Directory poll file lane — **not** syscall-level file I/O (see `file_lane_normalize`).
    "file_poll_snapshot",
    "file_changed_between_polls",
    "file_absent_in_poll_gap",
    "file_seen_in_poll_gap",
];

/// Maximum JSONL line length accepted when reading packs (DoS bound; **provisional** — see F-07 in `PHASE0_FREEZE_TRACKER.md`).
pub const PROVISIONAL_MAX_JSONL_LINE_BYTES: usize = 4 * 1024 * 1024;

/// Maximum `.glass_pack` file size accepted when reading into memory (**provisional** — F-07; revisit with streaming).
/// See `docs/PHASE0_FREEZE_TRACKER.md` F-07.
pub const PROVISIONAL_MAX_PACK_FILE_BYTES: usize = 256 * 1024 * 1024;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PackValidationLevel {
    /// Structural: ZIP entries, manifest presence, monotonic seq, session_id match, envelope basics.
    Basic,
    /// Also require `kind` ∈ §12.5 set.
    StrictKinds,
}

/// Validate one normalized envelope (always required for `Basic` pack validation).
pub fn validate_normalized_event(ev: &NormalizedEventEnvelope) -> Result<(), &'static str> {
    if ev.schema_version != CANONICAL_EVENT_SCHEMA_VERSION {
        return Err("event.schema_version must be glass.event.v0");
    }
    if ev.event_id.is_empty() {
        return Err("event.event_id must be non-empty");
    }
    if ev.session_id.is_empty() {
        return Err("event.session_id must be non-empty");
    }
    if ev.kind.is_empty() {
        return Err("event.kind must be non-empty");
    }
    if ev.seq < 1 {
        return Err("event.seq must be >= 1");
    }
    if ev.actor.entity_type.is_empty() || ev.actor.entity_id.is_empty() {
        return Err("event.actor.entity_type and entity_id required");
    }
    if !ev.attrs.is_object() {
        return Err("event.attrs must be a JSON object");
    }
    if !ev.source.is_object() {
        return Err("event.source must be a JSON object");
    }
    Ok(())
}

pub fn validate_event_kind_strict(kind: &str) -> Result<(), &'static str> {
    if KNOWN_EVENT_KINDS_V0.contains(&kind) {
        Ok(())
    } else {
        Err("event.kind not in v0 known set (spec §12.5)")
    }
}

/// Validate manifest for supported pack formats (`glass.pack.v0.scaffold` JSONL, `glass.pack.v0.scaffold_seg` binary segment).
pub fn validate_pack_manifest(m: &SessionManifest) -> Result<(), &'static str> {
    if m.session_id.is_empty() {
        return Err("manifest.session_id must be non-empty");
    }
    if m.capture_mode.is_empty() {
        return Err("manifest.capture_mode must be non-empty");
    }
    match m.pack_format_version.as_str() {
        PACK_FORMAT_SCAFFOLD_V0 => match m.events_blob.as_deref() {
            None | Some("events.jsonl") => Ok(()),
            Some(_) => Err(
                "manifest.events_blob must be absent or \"events.jsonl\" for glass.pack.v0.scaffold",
            ),
        },
        PACK_FORMAT_SCAFFOLD_SEG_V0 => match m.events_blob.as_deref() {
            Some("events.seg") => Ok(()),
            _ => Err(
                "manifest.events_blob must be \"events.seg\" for glass.pack.v0.scaffold_seg",
            ),
        },
        _ => Err("unsupported manifest.pack_format_version for this reader"),
    }
}

/// Cross-check manifest + ordered events after JSON parse.
/// `seq` must equal 1-based line index (consecutive), matching `SessionLog` append semantics.
pub fn validate_pack_events(
    m: &SessionManifest,
    events: &[NormalizedEventEnvelope],
    level: PackValidationLevel,
) -> Result<(), &'static str> {
    validate_pack_manifest(m)?;
    for (i, ev) in events.iter().enumerate() {
        validate_normalized_event(ev)?;
        if ev.session_id != m.session_id {
            return Err("event.session_id must match manifest.session_id");
        }
        let want = (i + 1) as u64;
        if ev.seq != want {
            return Err("event.seq must be 1-based consecutive matching line order");
        }
        if level == PackValidationLevel::StrictKinds {
            validate_event_kind_strict(&ev.kind)?;
        }
    }
    Ok(())
}

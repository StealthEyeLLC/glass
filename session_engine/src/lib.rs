//! Session engine: append-ordered events, pack serialization, share-safe sanitization.
//!
//! **Boundary:** owns session/pack/manifest truth for replay. Does not render and does not collect host telemetry.
//!
//! Pack formats: `glass.pack.v0.scaffold` (ZIP + `manifest.json` + `events.jsonl`, Tier B viewer) and `glass.pack.v0.scaffold_seg` (same ZIP + `events.seg` binary). See `events_seg` and `docs/PHASE0_FREEZE_TRACKER.md` F-02.

pub mod error;
pub mod event;
pub mod events_seg;
pub mod export;
pub mod file_lane_normalize;
pub mod manifest;
pub mod pack;
pub mod procfs_normalize;
pub mod sanitization;
pub mod session;
pub mod validate;

pub use error::{PackError, SessionEngineError};
pub use event::{EntityRef, NormalizedEventEnvelope};
pub use events_seg::{
    append_event_to_segment_file, decode_segment_bytes, encode_segment_bytes, read_segment_file,
    write_segment_file, SegError, EVENT_SEG_FORMAT_VERSION, EVENT_SEG_MAGIC,
    PROVISIONAL_MAX_SEG_RECORD_BYTES,
};
pub use export::{
    apply_sanitization_to_manifest, materialize_share_safe_file_lane_pack_bytes,
    materialize_share_safe_procfs_pack_bytes,
};
pub use file_lane_normalize::{
    normalize_file_lane_batch, normalize_file_lane_observation, FileLaneNormalizeError,
    FileLaneRawObservationDto, FS_POLL_FILE_ENTITY_PREFIX, RESOLUTION_FS_POLL_REL_PATH,
};
pub use manifest::SessionManifest;
pub use manifest::{PACK_FORMAT_SCAFFOLD_SEG_V0, PACK_FORMAT_SCAFFOLD_V0};
pub use pack::{
    pack_artifact_lane_hint, read_glass_pack, read_glass_pack_bytes, read_glass_pack_bytes_level,
    read_glass_pack_bytes_strict, validate_glass_pack_bytes, validate_glass_pack_bytes_strict,
    validate_raw_dev_pack_manifest, validate_share_safe_export_manifest, write_glass_pack,
    write_glass_pack_scaffold_seg_to_vec, write_glass_pack_to_vec,
};
pub use procfs_normalize::{
    normalize_procfs_batch, normalize_procfs_observation, ProcfsNormalizeError,
    ProcfsRawObservationDto, PROCFS_PROCESS_ENTITY_PREFIX, RESOLUTION_PID_EPHEMERAL_POLL,
};
pub use sanitization::{sanitize_events_for_share, SanitizationProfile, SanitizationResult};
pub use session::SessionLog;
pub use validate::{
    validate_event_kind_strict, validate_normalized_event, validate_pack_events,
    validate_pack_manifest, PackValidationLevel, CANONICAL_EVENT_SCHEMA_VERSION,
    KNOWN_EVENT_KINDS_V0, PROVISIONAL_MAX_JSONL_LINE_BYTES, PROVISIONAL_MAX_PACK_FILE_BYTES,
};

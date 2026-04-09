//! Binary `events.seg` v1 — **internal session segment** (F-02).
//!
//! Format (little-endian):
//! - **Header (12 bytes):** magic `GLSSG001` (8 bytes ASCII) + `u32` format version `1`
//! - **Records:** repeat `u32` payload byte length + UTF-8 JSON of one [`NormalizedEventEnvelope`](crate::event::NormalizedEventEnvelope)
//!
//! Ordering: records MUST be append order; decoded `seq` MUST be 1-based consecutive (same invariant as JSONL scaffold).
//!
//! **Provisional:** max record bytes = [`PROVISIONAL_MAX_JSONL_LINE_BYTES`](crate::validate::PROVISIONAL_MAX_JSONL_LINE_BYTES) (F-07 parity with JSONL line bound).
//!
//! **Tier B viewer** today consumes `glass.pack.v0.scaffold` + `events.jsonl` only; packs using `glass.pack.v0.scaffold_seg` are for Rust/tooling and future viewer support.

use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::Path;

use thiserror::Error;

use crate::event::NormalizedEventEnvelope;
use crate::validate::{validate_normalized_event, PROVISIONAL_MAX_JSONL_LINE_BYTES};

/// 8-byte magic identifying Glass segment v1 (`events.seg` payload).
pub const EVENT_SEG_MAGIC: &[u8; 8] = b"GLSSG001";

/// Format version in the file header (`u32` LE), distinct from pack `pack_format_version`.
pub const EVENT_SEG_FORMAT_VERSION: u32 = 1;

/// Same byte cap as JSONL lines per event (F-07).
pub const PROVISIONAL_MAX_SEG_RECORD_BYTES: usize = PROVISIONAL_MAX_JSONL_LINE_BYTES;

#[derive(Debug, Error)]
pub enum SegError {
    #[error("IO: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("invalid events.seg: {0}")]
    Invalid(&'static str),
    #[error("unsupported events.seg format version: {0} (expected {1})")]
    UnsupportedVersion(u32, u32),
    #[error("seq out of order: expected {expected}, got {got}")]
    SeqOrder { expected: u64, got: u64 },
}

fn write_header(w: &mut impl Write) -> Result<(), SegError> {
    w.write_all(EVENT_SEG_MAGIC.as_slice())?;
    w.write_all(&EVENT_SEG_FORMAT_VERSION.to_le_bytes())?;
    Ok(())
}

fn write_record(w: &mut impl Write, ev: &NormalizedEventEnvelope) -> Result<(), SegError> {
    let payload = serde_json::to_vec(ev)?;
    if payload.is_empty() {
        return Err(SegError::Invalid("empty JSON record"));
    }
    if payload.len() > PROVISIONAL_MAX_SEG_RECORD_BYTES {
        return Err(SegError::Invalid(
            "segment record exceeds maximum length (F-07)",
        ));
    }
    if payload.len() > u32::MAX as usize {
        return Err(SegError::Invalid(
            "segment record too large for u32 length prefix",
        ));
    }
    let len = payload.len() as u32;
    w.write_all(&len.to_le_bytes())?;
    w.write_all(&payload)?;
    Ok(())
}

/// Encode a full segment (header + all records). Caller should pass events with valid consecutive `seq`.
pub fn encode_segment_bytes(events: &[NormalizedEventEnvelope]) -> Result<Vec<u8>, SegError> {
    let mut v = Vec::new();
    write_header(&mut v)?;
    for ev in events {
        write_record(&mut v, ev)?;
    }
    Ok(v)
}

/// Decode segment bytes into events. Validates normalized envelope shape and consecutive `seq`.
pub fn decode_segment_bytes(bytes: &[u8]) -> Result<Vec<NormalizedEventEnvelope>, SegError> {
    if bytes.len() < 12 {
        return Err(SegError::Invalid("events.seg truncated (header)"));
    }
    if bytes.get(0..8) != Some(EVENT_SEG_MAGIC.as_slice()) {
        return Err(SegError::Invalid(
            "bad events.seg magic (expected GLSSG001)",
        ));
    }
    let ver = u32::from_le_bytes(bytes[8..12].try_into().unwrap());
    if ver != EVENT_SEG_FORMAT_VERSION {
        return Err(SegError::UnsupportedVersion(ver, EVENT_SEG_FORMAT_VERSION));
    }
    let mut offset: usize = 12;
    let mut out = Vec::new();
    let mut expected_seq: u64 = 1;
    while offset < bytes.len() {
        if offset + 4 > bytes.len() {
            return Err(SegError::Invalid("truncated length prefix"));
        }
        let len = u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap()) as usize;
        offset += 4;
        if len == 0 {
            return Err(SegError::Invalid("zero-length segment record"));
        }
        if len > PROVISIONAL_MAX_SEG_RECORD_BYTES {
            return Err(SegError::Invalid(
                "segment record length exceeds maximum (F-07)",
            ));
        }
        if offset + len > bytes.len() {
            return Err(SegError::Invalid("truncated segment record payload"));
        }
        let ev: NormalizedEventEnvelope = serde_json::from_slice(&bytes[offset..offset + len])?;
        validate_normalized_event(&ev)
            .map_err(|_| SegError::Invalid("invalid normalized event in segment"))?;
        if ev.seq != expected_seq {
            return Err(SegError::SeqOrder {
                expected: expected_seq,
                got: ev.seq,
            });
        }
        expected_seq += 1;
        offset += len;
        out.push(ev);
    }
    Ok(out)
}

/// Read a segment file from disk (full parse + validation).
pub fn read_segment_file(path: &Path) -> Result<Vec<NormalizedEventEnvelope>, SegError> {
    let bytes = std::fs::read(path)?;
    decode_segment_bytes(&bytes)
}

/// Write a full segment file (truncate).
pub fn write_segment_file(path: &Path, events: &[NormalizedEventEnvelope]) -> Result<(), SegError> {
    let v = encode_segment_bytes(events)?;
    std::fs::write(path, v)?;
    Ok(())
}

/// Append one record to an existing segment file, or create a new file with header + first record.
/// `ev.seq` must equal `existing_count + 1`.
pub fn append_event_to_segment_file(
    path: &Path,
    ev: &NormalizedEventEnvelope,
) -> Result<(), SegError> {
    validate_normalized_event(ev).map_err(|_| SegError::Invalid("invalid normalized event"))?;
    if !path.exists() {
        if ev.seq != 1 {
            return Err(SegError::SeqOrder {
                expected: 1,
                got: ev.seq,
            });
        }
        let mut f = File::create(path)?;
        write_header(&mut f)?;
        write_record(&mut f, ev)?;
        return Ok(());
    }
    let existing = read_segment_file(path)?;
    let next = (existing.len() as u64) + 1;
    if ev.seq != next {
        return Err(SegError::SeqOrder {
            expected: next,
            got: ev.seq,
        });
    }
    let mut f = OpenOptions::new().append(true).open(path)?;
    write_record(&mut f, ev)?;
    Ok(())
}

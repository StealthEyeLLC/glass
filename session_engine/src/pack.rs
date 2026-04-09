use std::io::{Cursor, Read, Write};
use std::path::Path;

use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter};

use crate::error::PackError;
use crate::event::NormalizedEventEnvelope;
use crate::events_seg;
use crate::manifest::{SessionManifest, PACK_FORMAT_SCAFFOLD_SEG_V0, PACK_FORMAT_SCAFFOLD_V0};
use crate::validate::{
    validate_pack_events, PackValidationLevel, PROVISIONAL_MAX_JSONL_LINE_BYTES,
    PROVISIONAL_MAX_PACK_FILE_BYTES,
};

const MANIFEST_PATH: &str = "manifest.json";
const EVENTS_JSONL_PATH: &str = "events.jsonl";
const EVENTS_SEG_PATH: &str = "events.seg";

/// Write a `.glass_pack` ZIP (`glass.pack.v0.scaffold` + `events.jsonl`).
pub fn write_glass_pack(
    path: &Path,
    manifest: &SessionManifest,
    events: &[NormalizedEventEnvelope],
) -> Result<(), PackError> {
    let v = write_glass_pack_to_vec(manifest, events)?;
    std::fs::write(path, v)?;
    Ok(())
}

/// Serialize JSONL scaffold pack to bytes (Tier B viewer compatible).
pub fn write_glass_pack_to_vec(
    manifest: &SessionManifest,
    events: &[NormalizedEventEnvelope],
) -> Result<Vec<u8>, PackError> {
    if manifest.pack_format_version != PACK_FORMAT_SCAFFOLD_V0 {
        return Err(PackError::Invalid(
            "write_glass_pack_to_vec requires glass.pack.v0.scaffold (use write_glass_pack_scaffold_seg_to_vec for seg)",
        ));
    }
    validate_pack_events(manifest, events, PackValidationLevel::Basic)?;
    let mut buf = Cursor::new(Vec::new());
    {
        let mut zw = ZipWriter::new(&mut buf);
        let opts = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        zw.start_file(MANIFEST_PATH, opts)?;
        let mjson = serde_json::to_vec_pretty(manifest)?;
        zw.write_all(&mjson)?;

        zw.start_file(EVENTS_JSONL_PATH, opts)?;
        for ev in events {
            let line = serde_json::to_string(ev)?;
            if line.len() > PROVISIONAL_MAX_JSONL_LINE_BYTES {
                return Err(PackError::Invalid(
                    "single event JSON exceeds jsonl line limit",
                ));
            }
            zw.write_all(line.as_bytes())?;
            zw.write_all(b"\n")?;
        }
        zw.finish()?;
    }
    Ok(buf.into_inner())
}

/// Write a `.glass_pack` ZIP (`glass.pack.v0.scaffold_seg` + binary `events.seg`). **Not** consumed by the current Tier B viewer.
pub fn write_glass_pack_scaffold_seg_to_vec(
    manifest: &SessionManifest,
    events: &[NormalizedEventEnvelope],
) -> Result<Vec<u8>, PackError> {
    if manifest.pack_format_version != PACK_FORMAT_SCAFFOLD_SEG_V0 {
        return Err(PackError::Invalid(
            "write_glass_pack_scaffold_seg_to_vec requires glass.pack.v0.scaffold_seg manifest",
        ));
    }
    validate_pack_events(manifest, events, PackValidationLevel::Basic)?;
    let seg_body = events_seg::encode_segment_bytes(events)?;
    let mut buf = Cursor::new(Vec::new());
    {
        let mut zw = ZipWriter::new(&mut buf);
        let opts = FileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        zw.start_file(MANIFEST_PATH, opts)?;
        zw.write_all(&serde_json::to_vec_pretty(manifest)?)?;
        zw.start_file(EVENTS_SEG_PATH, opts)?;
        zw.write_all(&seg_body)?;
        zw.finish()?;
    }
    Ok(buf.into_inner())
}

/// Read pack from disk (validates at `Basic` level).
pub fn read_glass_pack(
    path: &Path,
) -> Result<(SessionManifest, Vec<NormalizedEventEnvelope>), PackError> {
    let bytes = std::fs::read(path)?;
    read_glass_pack_bytes(bytes.as_slice())
}

/// Parse ZIP bytes; validate manifest + events (`Basic`).
pub fn read_glass_pack_bytes(
    bytes: &[u8],
) -> Result<(SessionManifest, Vec<NormalizedEventEnvelope>), PackError> {
    read_glass_pack_bytes_level(bytes, PackValidationLevel::Basic)
}

pub fn read_glass_pack_bytes_strict(
    bytes: &[u8],
) -> Result<(SessionManifest, Vec<NormalizedEventEnvelope>), PackError> {
    read_glass_pack_bytes_level(bytes, PackValidationLevel::StrictKinds)
}

/// Parse and validate at the given level.
pub fn read_glass_pack_bytes_level(
    bytes: &[u8],
    level: PackValidationLevel,
) -> Result<(SessionManifest, Vec<NormalizedEventEnvelope>), PackError> {
    if bytes.len() > PROVISIONAL_MAX_PACK_FILE_BYTES {
        return Err(PackError::Invalid(
            "pack file exceeds maximum size (F-07 PROVISIONAL_MAX_PACK_FILE_BYTES)",
        ));
    }
    if bytes.len() < 4 || bytes.get(0..2) != Some(&[0x50, 0x4b]) {
        return Err(PackError::Invalid("not a ZIP (missing PK header)"));
    }
    let cursor = Cursor::new(bytes);
    let mut arch = ZipArchive::new(cursor)?;
    let mut manifest: Option<SessionManifest> = None;
    let mut jsonl: Option<String> = None;
    let mut seg_raw: Option<Vec<u8>> = None;
    let mut saw_manifest = false;
    let mut saw_jsonl = false;
    let mut saw_seg = false;

    for i in 0..arch.len() {
        let mut f = arch.by_index(i)?;
        let name = f.name().to_string();
        if name == MANIFEST_PATH {
            let mut buf = String::new();
            f.read_to_string(&mut buf)?;
            manifest = Some(serde_json::from_str(&buf)?);
            saw_manifest = true;
        } else if name == EVENTS_JSONL_PATH {
            let mut buf = String::new();
            f.read_to_string(&mut buf)?;
            jsonl = Some(buf);
            saw_jsonl = true;
        } else if name == EVENTS_SEG_PATH {
            let mut buf = Vec::new();
            f.read_to_end(&mut buf)?;
            seg_raw = Some(buf);
            saw_seg = true;
        }
    }

    if !saw_manifest {
        return Err(PackError::MissingEntry("manifest.json"));
    }
    let manifest = manifest.ok_or(PackError::MissingEntry("manifest.json"))?;

    let events: Vec<NormalizedEventEnvelope> = match manifest.pack_format_version.as_str() {
        PACK_FORMAT_SCAFFOLD_V0 => {
            if saw_seg {
                return Err(PackError::Invalid(
                    "glass.pack.v0.scaffold pack must not contain events.seg",
                ));
            }
            if !saw_jsonl {
                return Err(PackError::MissingEntry("events.jsonl"));
            }
            let buf = jsonl.ok_or(PackError::MissingEntry("events.jsonl"))?;
            parse_jsonl_events(&buf)?
        }
        PACK_FORMAT_SCAFFOLD_SEG_V0 => {
            if saw_jsonl {
                return Err(PackError::Invalid(
                    "glass.pack.v0.scaffold_seg pack must not contain events.jsonl",
                ));
            }
            if !saw_seg {
                return Err(PackError::MissingEntry("events.seg"));
            }
            let raw = seg_raw.ok_or(PackError::MissingEntry("events.seg"))?;
            events_seg::decode_segment_bytes(&raw).map_err(PackError::from)?
        }
        _ => {
            return Err(PackError::Invalid(
                "unsupported manifest.pack_format_version for this reader",
            ));
        }
    };

    validate_pack_events(&manifest, &events, level)?;
    Ok((manifest, events))
}

fn parse_jsonl_events(buf: &str) -> Result<Vec<NormalizedEventEnvelope>, PackError> {
    let mut events = Vec::new();
    for line in buf.lines() {
        let line = line.trim_end();
        if line.is_empty() {
            continue;
        }
        if line.len() > PROVISIONAL_MAX_JSONL_LINE_BYTES {
            return Err(PackError::Invalid("jsonl line exceeds maximum length"));
        }
        events.push(serde_json::from_str(line)?);
    }
    Ok(events)
}

/// Validate bytes (Basic).
pub fn validate_glass_pack_bytes(bytes: &[u8]) -> Result<(), PackError> {
    read_glass_pack_bytes(bytes)?;
    Ok(())
}

/// Validate bytes including strict §12.5 kinds.
pub fn validate_glass_pack_bytes_strict(bytes: &[u8]) -> Result<(), PackError> {
    read_glass_pack_bytes_strict(bytes)?;
    Ok(())
}

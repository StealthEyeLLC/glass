use std::io::{Cursor, Write};

use session_engine::manifest::{SessionManifest, PACK_FORMAT_SCAFFOLD_V0};
use session_engine::NormalizedEventEnvelope;
use session_engine::{
    validate_glass_pack_bytes, validate_glass_pack_bytes_strict, write_glass_pack_to_vec, PackError,
};
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipWriter};

/// Build a ZIP without `write_glass_pack_to_vec` checks (simulates hostile or legacy writer).
fn zip_jsonl_pack(manifest: &SessionManifest, events: &[NormalizedEventEnvelope]) -> Vec<u8> {
    let mut buf = Cursor::new(Vec::new());
    {
        let mut zw = ZipWriter::new(&mut buf);
        let opts = FileOptions::default().compression_method(CompressionMethod::Stored);
        zw.start_file("manifest.json", opts).unwrap();
        zw.write_all(serde_json::to_string(manifest).unwrap().as_bytes())
            .unwrap();
        zw.start_file("events.jsonl", opts).unwrap();
        for ev in events {
            let line = serde_json::to_string(ev).unwrap();
            zw.write_all(line.as_bytes()).unwrap();
            zw.write_all(b"\n").unwrap();
        }
        zw.finish().unwrap();
    }
    buf.into_inner()
}

#[test]
fn rejects_non_zip_magic() {
    let r = validate_glass_pack_bytes(b"not a zip");
    assert!(matches!(r, Err(PackError::Invalid(_))));
}

#[test]
fn rejects_wrong_pack_format_version() {
    let mut m = SessionManifest::scaffold_new("s");
    m.pack_format_version = "glass.pack.future".to_string();
    let ev = NormalizedEventEnvelope::minimal_stub(1, "s", "process_start");
    let bytes = zip_jsonl_pack(&m, &[ev]);
    let r = validate_glass_pack_bytes(&bytes);
    assert!(r.is_err());
}

#[test]
fn rejects_session_id_mismatch() {
    let m = SessionManifest::scaffold_new("ses_a");
    let ev = NormalizedEventEnvelope::minimal_stub(1, "ses_b", "process_start");
    let bytes = zip_jsonl_pack(&m, &[ev]);
    let r = validate_glass_pack_bytes(&bytes);
    assert!(r.is_err());
}

#[test]
fn rejects_unknown_kind_in_strict_mode() {
    let m = SessionManifest::scaffold_new("s");
    let ev = NormalizedEventEnvelope::minimal_stub(1, "s", "not_a_real_kind");
    let bytes = write_glass_pack_to_vec(&m, &[ev]).unwrap();
    assert!(validate_glass_pack_bytes(&bytes).is_ok());
    assert!(validate_glass_pack_bytes_strict(&bytes).is_err());
}

#[test]
fn accepts_known_kinds_in_strict_mode() {
    let m = SessionManifest::scaffold_new("s");
    let ev = NormalizedEventEnvelope::minimal_stub(1, "s", "file_read");
    let bytes = write_glass_pack_to_vec(&m, &[ev]).unwrap();
    validate_glass_pack_bytes_strict(&bytes).unwrap();
}

#[test]
fn format_constant_matches_manifest_default() {
    let m = SessionManifest::scaffold_new("x");
    assert_eq!(m.pack_format_version, PACK_FORMAT_SCAFFOLD_V0);
}

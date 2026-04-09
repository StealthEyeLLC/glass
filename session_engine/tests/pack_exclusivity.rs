//! ZIP must not mix `events.jsonl` and `events.seg` for a given scaffold variant.
use std::io::{Cursor, Write};

use session_engine::manifest::SessionManifest;
use session_engine::{read_glass_pack_bytes, PackError};
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipWriter};

fn zip_both_blobs(manifest: &SessionManifest, jsonl: &str, seg_dummy: &[u8]) -> Vec<u8> {
    let mut buf = Cursor::new(Vec::new());
    {
        let mut zw = ZipWriter::new(&mut buf);
        let opts = FileOptions::default().compression_method(CompressionMethod::Stored);
        zw.start_file("manifest.json", opts).unwrap();
        zw.write_all(serde_json::to_string(manifest).unwrap().as_bytes())
            .unwrap();
        zw.start_file("events.jsonl", opts).unwrap();
        zw.write_all(jsonl.as_bytes()).unwrap();
        zw.start_file("events.seg", opts).unwrap();
        zw.write_all(seg_dummy).unwrap();
        zw.finish().unwrap();
    }
    buf.into_inner()
}

#[test]
fn scaffold_rejects_zip_containing_events_seg() {
    let m = SessionManifest::scaffold_new("s");
    let ev = session_engine::NormalizedEventEnvelope::minimal_stub(1, "s", "process_start");
    let jsonl = format!("{}\n", serde_json::to_string(&ev).unwrap());
    let zip = zip_both_blobs(&m, &jsonl, b"GLSSG001\x01\x00\x00\x00");
    let r = read_glass_pack_bytes(&zip);
    assert!(matches!(r, Err(PackError::Invalid(_))));
}

#[test]
fn scaffold_seg_rejects_zip_containing_events_jsonl() {
    let m = SessionManifest::scaffold_seg_new("s");
    let ev = session_engine::NormalizedEventEnvelope::minimal_stub(1, "s", "process_start");
    let jsonl = format!("{}\n", serde_json::to_string(&ev).unwrap());
    let seg = session_engine::encode_segment_bytes(&[ev]).unwrap();
    let mut buf = Cursor::new(Vec::new());
    {
        let mut zw = ZipWriter::new(&mut buf);
        let opts = FileOptions::default().compression_method(CompressionMethod::Stored);
        zw.start_file("manifest.json", opts).unwrap();
        zw.write_all(serde_json::to_string(&m).unwrap().as_bytes())
            .unwrap();
        zw.start_file("events.jsonl", opts).unwrap();
        zw.write_all(jsonl.as_bytes()).unwrap();
        zw.start_file("events.seg", opts).unwrap();
        zw.write_all(&seg).unwrap();
        zw.finish().unwrap();
    }
    let zip = buf.into_inner();
    let r = read_glass_pack_bytes(&zip);
    assert!(matches!(r, Err(PackError::Invalid(_))));
}

#[test]
fn rejects_unknown_pack_format_version() {
    let mut m = SessionManifest::scaffold_new("s");
    m.pack_format_version = "glass.pack.unknown".to_string();
    let ev = session_engine::NormalizedEventEnvelope::minimal_stub(1, "s", "process_start");
    let mut buf = Cursor::new(Vec::new());
    {
        let mut zw = ZipWriter::new(&mut buf);
        let opts = FileOptions::default().compression_method(CompressionMethod::Stored);
        zw.start_file("manifest.json", opts).unwrap();
        zw.write_all(serde_json::to_string(&m).unwrap().as_bytes())
            .unwrap();
        zw.start_file("events.jsonl", opts).unwrap();
        zw.write_all(format!("{}\n", serde_json::to_string(&ev).unwrap()).as_bytes())
            .unwrap();
        zw.finish().unwrap();
    }
    let r = read_glass_pack_bytes(&buf.into_inner());
    assert!(matches!(r, Err(PackError::Invalid(_))));
}

#[test]
fn write_glass_pack_to_vec_rejects_seg_manifest() {
    let m = SessionManifest::scaffold_seg_new("s");
    let ev = session_engine::NormalizedEventEnvelope::minimal_stub(1, "s", "process_start");
    let r = session_engine::write_glass_pack_to_vec(&m, &[ev]);
    assert!(r.is_err());
}

#[test]
fn write_scaffold_seg_rejects_jsonl_manifest() {
    let m = SessionManifest::scaffold_new("s");
    let ev = session_engine::NormalizedEventEnvelope::minimal_stub(1, "s", "process_start");
    let r = session_engine::write_glass_pack_scaffold_seg_to_vec(&m, &[ev]);
    assert!(r.is_err());
}

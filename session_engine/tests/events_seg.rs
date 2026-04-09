use session_engine::events_seg::{
    append_event_to_segment_file, decode_segment_bytes, encode_segment_bytes, read_segment_file,
    write_segment_file, SegError, EVENT_SEG_MAGIC,
};
use session_engine::NormalizedEventEnvelope;
use session_engine::{SessionLog, SessionManifest};
use tempfile::tempdir;

#[test]
fn encode_decode_roundtrip_ordered() {
    let e1 = NormalizedEventEnvelope::minimal_stub(1, "s", "process_start");
    let e2 = NormalizedEventEnvelope::minimal_stub(2, "s", "process_end");
    let bytes = encode_segment_bytes(&[e1.clone(), e2.clone()]).unwrap();
    let out = decode_segment_bytes(&bytes).unwrap();
    assert_eq!(out, vec![e1, e2]);
}

#[test]
fn decode_empty_body_after_header() {
    let mut v = Vec::new();
    v.extend_from_slice(EVENT_SEG_MAGIC.as_slice());
    v.extend_from_slice(&1u32.to_le_bytes());
    let out = decode_segment_bytes(&v).unwrap();
    assert!(out.is_empty());
}

#[test]
fn decode_rejects_bad_magic() {
    let mut v = vec![0u8; 12];
    v[0..8].copy_from_slice(b"XXXXXXXX");
    let r = decode_segment_bytes(&v);
    assert!(matches!(r, Err(SegError::Invalid(_))));
}

#[test]
fn decode_rejects_truncated_payload() {
    let mut v =
        encode_segment_bytes(&[NormalizedEventEnvelope::minimal_stub(1, "s", "x")]).unwrap();
    v.truncate(v.len() - 2);
    assert!(decode_segment_bytes(&v).is_err());
}

#[test]
fn decode_rejects_seq_gap() {
    let a = NormalizedEventEnvelope::minimal_stub(1, "s", "a");
    let mut b = NormalizedEventEnvelope::minimal_stub(3, "s", "b");
    b.seq = 3;
    let bytes = encode_segment_bytes(&[a, b]).unwrap();
    // encoding allowed arbitrary seq in encode - actually encode doesn't validate seq order!
    // So we manually craft corrupt segment: two records with seq 1 and 3
    let r = decode_segment_bytes(&bytes);
    assert!(matches!(r, Err(SegError::SeqOrder { .. })));
}

#[test]
fn append_creates_file_and_extends() {
    let dir = tempdir().unwrap();
    let p = dir.path().join("s.seg");
    let e1 = NormalizedEventEnvelope::minimal_stub(1, "s", "process_start");
    let e2 = NormalizedEventEnvelope::minimal_stub(2, "s", "process_end");
    append_event_to_segment_file(&p, &e1).unwrap();
    append_event_to_segment_file(&p, &e2).unwrap();
    let got = read_segment_file(&p).unwrap();
    assert_eq!(got.len(), 2);
    assert_eq!(got[0].seq, 1);
    assert_eq!(got[1].seq, 2);
}

#[test]
fn append_rejects_wrong_seq() {
    let dir = tempdir().unwrap();
    let p = dir.path().join("s.seg");
    let e2 = NormalizedEventEnvelope::minimal_stub(2, "s", "x");
    let r = append_event_to_segment_file(&p, &e2);
    assert!(matches!(r, Err(SegError::SeqOrder { .. })));
}

#[test]
fn write_segment_file_roundtrip() {
    let dir = tempdir().unwrap();
    let p = dir.path().join("out.seg");
    let evs = vec![
        NormalizedEventEnvelope::minimal_stub(1, "ses", "file_read"),
        NormalizedEventEnvelope::minimal_stub(2, "ses", "file_write"),
    ];
    write_segment_file(&p, &evs).unwrap();
    let got = read_segment_file(&p).unwrap();
    assert_eq!(got, evs);
}

#[test]
fn session_log_from_seg_path_matches_pack_ordering() {
    let dir = tempdir().unwrap();
    let p = dir.path().join("log.seg");
    let evs = vec![
        NormalizedEventEnvelope::minimal_stub(1, "ses", "process_start"),
        NormalizedEventEnvelope::minimal_stub(2, "ses", "process_end"),
    ];
    write_segment_file(&p, &evs).unwrap();
    let log = SessionLog::from_seg_path(&p).unwrap();
    assert_eq!(log.events(), evs.as_slice());
}

#[test]
fn scaffold_jsonl_and_scaffold_seg_pack_same_events() {
    let mut m_json = SessionManifest::scaffold_new("ses");
    let mut m_seg = SessionManifest::scaffold_seg_new("ses");
    m_json.sanitized = false;
    m_seg.sanitized = false;
    let evs = vec![
        NormalizedEventEnvelope::minimal_stub(1, "ses", "process_start"),
        NormalizedEventEnvelope::minimal_stub(2, "ses", "process_end"),
    ];
    let zip_json = session_engine::write_glass_pack_to_vec(&m_json, &evs).unwrap();
    let zip_seg = session_engine::write_glass_pack_scaffold_seg_to_vec(&m_seg, &evs).unwrap();
    let (_, j) = session_engine::read_glass_pack_bytes(&zip_json).unwrap();
    let (_, s) = session_engine::read_glass_pack_bytes(&zip_seg).unwrap();
    assert_eq!(j, s);
    assert_eq!(j, evs);
}

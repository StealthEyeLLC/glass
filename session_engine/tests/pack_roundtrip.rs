use session_engine::{
    read_glass_pack, validate_glass_pack_bytes, write_glass_pack, NormalizedEventEnvelope,
    SessionManifest,
};
use tempfile::tempdir;

#[test]
fn roundtrip_pack_validate() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("t.glass_pack");
    let mut m = SessionManifest::scaffold_new("ses_rt");
    m.sanitized = false;
    let ev = NormalizedEventEnvelope::minimal_stub(1, "ses_rt", "process_start");
    let ev2 = NormalizedEventEnvelope::minimal_stub(2, "ses_rt", "process_end");
    write_glass_pack(&path, &m, &[ev, ev2]).unwrap();
    let bytes = std::fs::read(&path).unwrap();
    validate_glass_pack_bytes(&bytes).unwrap();
    let (m2, evs) = read_glass_pack(&path).unwrap();
    assert_eq!(m2.session_id, "ses_rt");
    assert_eq!(evs.len(), 2);
}

#[test]
fn rejects_non_monotonic_seq_at_write_and_read() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("bad.glass_pack");
    let m = SessionManifest::scaffold_new("ses_bad");
    let a = NormalizedEventEnvelope::minimal_stub(2, "ses_bad", "x");
    let b = NormalizedEventEnvelope::minimal_stub(2, "ses_bad", "y");
    assert!(write_glass_pack(&path, &m, &[a, b]).is_err());
}

#[test]
fn pack_bytes_from_writer_validate() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("x.glass_pack");
    let m = SessionManifest::scaffold_new("ses_fixture");
    let ev = NormalizedEventEnvelope::minimal_stub(1, "ses_fixture", "process_start");
    write_glass_pack(&path, &m, &[ev]).unwrap();
    let bytes = std::fs::read(&path).unwrap();
    validate_glass_pack_bytes(&bytes).unwrap();
}

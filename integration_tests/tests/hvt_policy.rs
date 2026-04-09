use std::fs;
use std::path::PathBuf;

use serde::Deserialize;

#[derive(Debug, Deserialize)]
struct HvtFile {
    #[allow(dead_code)]
    version: u64,
    cap: u64,
    pattern: Vec<HvtPattern>,
}

#[derive(Debug, Deserialize)]
struct HvtPattern {
    #[allow(dead_code)]
    id: String,
}

#[test]
fn hvt_pattern_count_within_cap() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    let path = root.join("collector/config/hvt_rules.toml");
    let raw = fs::read_to_string(&path).expect("read hvt_rules.toml");
    let file: HvtFile = toml::from_str(&raw).expect("parse hvt_rules.toml");
    assert!(
        file.pattern.len() as u64 <= file.cap,
        "pattern count {} exceeds cap {}",
        file.pattern.len(),
        file.cap
    );
    assert!(file.cap <= 20, "program cap should be <= 20 for v0");
}

use std::path::PathBuf;

#[test]
fn golden_scene_harness_present() {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    let readme = root.join("tools/golden_scenes/README.md");
    let capture = root.join("tools/golden_scenes/capture.mjs");
    assert!(readme.is_file(), "golden README missing");
    assert!(capture.is_file(), "golden capture.mjs missing");
}

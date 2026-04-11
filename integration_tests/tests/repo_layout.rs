use std::path::PathBuf;

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

#[test]
fn required_top_level_dirs_exist() {
    let root = repo_root();
    for d in [
        "schema",
        "session_engine",
        "graph_engine",
        "collector",
        "bridge",
        "viewer",
        "demos",
        "docs",
        "scripts",
        "tests",
        "assets",
        "tools",
    ] {
        let p = root.join(d);
        assert!(p.is_dir(), "missing directory: {}", p.display());
    }
}

#[test]
fn viewer_has_package_json() {
    let p = repo_root().join("viewer/package.json");
    assert!(p.is_file(), "viewer/package.json missing");
}

#[test]
fn retained_snapshot_demo_bundle_present() {
    let root = repo_root();
    for f in [
        "scripts/retained_snapshot_demo/raw_observations_demo.json",
        "scripts/retained_snapshot_demo/demo.sh",
        "scripts/retained_snapshot_demo/demo.ps1",
        "docs/DEMO_RETAINED_SNAPSHOT.md",
    ] {
        let p = root.join(f);
        assert!(p.is_file(), "missing retained demo file: {}", p.display());
    }
}

#[test]
fn vertical_slice_v0_tier_b_pack_present() {
    let p = repo_root()
        .join("tests/fixtures/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack");
    assert!(
        p.is_file(),
        "missing Vertical Slice v0 fixture pack: {}",
        p.display()
    );
}

#[test]
fn canonical_scenarios_v15_packs_present() {
    let root = repo_root().join("tests/fixtures/canonical_scenarios_v15");
    for f in [
        "canonical_v15_replace_heavy.glass_pack",
        "canonical_v15_append_heavy.glass_pack",
        "canonical_v15_calm_steady.glass_pack",
        "canonical_v15_file_heavy.glass_pack",
    ] {
        let p = root.join(f);
        assert!(
            p.is_file(),
            "missing Vertical Slice v15 scenario pack: {}",
            p.display()
        );
    }
}

//! `glass-pack` — validate and inspect `.glass_pack` ZIPs (canonical tooling boundary).

use std::path::PathBuf;

use clap::{Parser, Subcommand};
use session_engine::{
    pack_artifact_lane_hint, read_glass_pack_bytes, read_glass_pack_bytes_strict,
    validate_raw_dev_pack_manifest, validate_share_safe_export_manifest,
};

#[derive(Parser)]
#[command(
    name = "glass-pack",
    version,
    about = "Validate and inspect .glass_pack archives (Tier B JSONL scaffold)"
)]
struct Cli {
    #[command(subcommand)]
    cmd: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Validate ZIP + manifest + events. Default: structural (Basic). Use `--strict-kinds` for spec §12.5 kinds.
    Validate {
        path: PathBuf,
        /// Require every event `kind` to be in the v0 strict set (Tier B `strict_kinds` parity).
        #[arg(long = "strict-kinds", alias = "strict")]
        strict_kinds: bool,
        /// Fail unless manifest matches share-safe export markers (`export-procfs-pack` lane).
        #[arg(long)]
        expect_share_safe: bool,
        /// Fail unless manifest is unsanitized (typical `normalize-procfs` dev artifact).
        #[arg(long)]
        expect_raw_dev: bool,
        /// Emit one JSON object on success (stderr still used for errors).
        #[arg(long)]
        json: bool,
    },
    /// Print manifest + event count + sanitization / lane hints.
    Info {
        path: PathBuf,
        #[arg(long)]
        json: bool,
    },
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    match cli.cmd {
        Command::Validate {
            path,
            strict_kinds,
            expect_share_safe,
            expect_raw_dev,
            json,
        } => {
            if expect_share_safe && expect_raw_dev {
                eprintln!("glass-pack: cannot combine --expect-share-safe and --expect-raw-dev");
                std::process::exit(2);
            }

            let bytes = std::fs::read(&path)?;
            let (manifest, events) = if strict_kinds {
                read_glass_pack_bytes_strict(&bytes)?
            } else {
                read_glass_pack_bytes(&bytes)?
            };

            if expect_share_safe {
                validate_share_safe_export_manifest(&manifest).map_err(|e| {
                    format!(
                        "share-safe manifest check failed: {e} (pack is not a complete export-lane artifact)"
                    )
                })?;
            }
            if expect_raw_dev {
                validate_raw_dev_pack_manifest(&manifest).map_err(|e| {
                    format!(
                        "raw/dev manifest check failed: {e} (pack looks export-sanitized or non-dev)"
                    )
                })?;
            }

            let lane = pack_artifact_lane_hint(&manifest);
            let markers_ok = validate_share_safe_export_manifest(&manifest).is_ok();

            if json {
                println!(
                    "{}",
                    serde_json::json!({
                        "ok": true,
                        "path": path.to_string_lossy(),
                        "strict_kinds": strict_kinds,
                        "expect_share_safe": expect_share_safe,
                        "expect_raw_dev": expect_raw_dev,
                        "event_count": events.len(),
                        "artifact_lane_hint": lane,
                        "share_safe_markers_complete": markers_ok,
                    })
                );
            } else {
                println!("OK {}", path.display());
                println!("  strict_kinds: {}", strict_kinds);
                println!("  events: {}", events.len());
                println!("  artifact_lane_hint: {lane}");
                if expect_share_safe {
                    println!("  expect_share_safe: passed");
                }
                if expect_raw_dev {
                    println!("  expect_raw_dev: passed");
                }
            }
        }
        Command::Info { path, json } => {
            let bytes = std::fs::read(&path)?;
            let (m, evs) = read_glass_pack_bytes(&bytes)?;
            let lane = pack_artifact_lane_hint(&m);
            let markers_ok = validate_share_safe_export_manifest(&m).is_ok();

            if json {
                println!(
                    "{}",
                    serde_json::json!({
                        "path": path.to_string_lossy(),
                        "session_id": m.session_id,
                        "pack_format_version": m.pack_format_version,
                        "capture_mode": m.capture_mode,
                        "events_blob": m.events_blob,
                        "event_count": evs.len(),
                        "sanitized": m.sanitized,
                        "share_safe_recommended": m.share_safe_recommended,
                        "export_sanitization_profile": m.export_sanitization_profile,
                        "sanitization_profile_version": m.sanitization_profile_version,
                        "human_readable_redaction_summary": m.human_readable_redaction_summary,
                        "artifact_lane_hint": lane,
                        "share_safe_markers_complete": markers_ok,
                        "fidelity_tier": m.fidelity_tier,
                        "active_adapter_id": m.active_adapter_id,
                    })
                );
            } else {
                println!("path: {}", path.display());
                println!("session_id: {}", m.session_id);
                println!("pack_format_version: {}", m.pack_format_version);
                println!("capture_mode: {}", m.capture_mode);
                println!("events_blob: {:?}", m.events_blob);
                println!("event_count: {}", evs.len());
                println!("sanitized: {}", m.sanitized);
                println!("share_safe_recommended: {}", m.share_safe_recommended);
                println!(
                    "export_sanitization_profile: {:?}",
                    m.export_sanitization_profile
                );
                println!(
                    "sanitization_profile_version: {:?}",
                    m.sanitization_profile_version
                );
                println!(
                    "human_readable_redaction_summary ({} lines):",
                    m.human_readable_redaction_summary.len()
                );
                for line in &m.human_readable_redaction_summary {
                    println!("  - {line}");
                }
                println!("artifact_lane_hint: {lane}");
                println!("share_safe_markers_complete: {markers_ok}");
                if let Some(ref a) = m.active_adapter_id {
                    println!("active_adapter_id: {a}");
                }
                if let Some(ref f) = m.fidelity_tier {
                    println!("fidelity_tier: {f}");
                }
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use session_engine::{
        materialize_share_safe_procfs_pack_bytes, normalize_procfs_batch, read_glass_pack_bytes,
        read_glass_pack_bytes_strict, validate_raw_dev_pack_manifest,
        validate_share_safe_export_manifest, write_glass_pack_to_vec, ProcfsRawObservationDto,
        SessionLog, SessionManifest,
    };

    fn sample_share_safe_bytes() -> Vec<u8> {
        let dto = ProcfsRawObservationDto {
            observation_seq: 1,
            session_id: "t".to_string(),
            ts_monotonic_ns: 1,
            raw_kind: "process_sample".to_string(),
            payload: serde_json::json!({"pid": 1, "comm": "x", "semantics": "procfs_poll_snapshot"}),
        };
        let evs = normalize_procfs_batch(&[dto]).unwrap();
        materialize_share_safe_procfs_pack_bytes(&evs, "t").unwrap()
    }

    fn sample_raw_dev_bytes() -> Vec<u8> {
        let dto = ProcfsRawObservationDto {
            observation_seq: 1,
            session_id: "t".to_string(),
            ts_monotonic_ns: 1,
            raw_kind: "process_sample".to_string(),
            payload: serde_json::json!({"pid": 1, "comm": "x", "semantics": "procfs_poll_snapshot"}),
        };
        let mut log = SessionLog::new();
        log.append_procfs_dtos(&[dto]).unwrap();
        let m = SessionManifest::procfs_poll_dev_scaffold("t");
        write_glass_pack_to_vec(&m, log.events()).unwrap()
    }

    #[test]
    fn strict_validate_share_safe_roundtrip() {
        let bytes = sample_share_safe_bytes();
        read_glass_pack_bytes_strict(&bytes).unwrap();
        let (m, _) = read_glass_pack_bytes(&bytes).unwrap();
        validate_share_safe_export_manifest(&m).unwrap();
    }

    #[test]
    fn raw_dev_fails_share_safe_manifest_check() {
        let bytes = sample_raw_dev_bytes();
        let (m, _) = read_glass_pack_bytes(&bytes).unwrap();
        assert!(validate_share_safe_export_manifest(&m).is_err());
        validate_raw_dev_pack_manifest(&m).unwrap();
    }

    #[test]
    fn incomplete_sanitized_manifest_fails_share_safe_check() {
        let mut m = SessionManifest::procfs_poll_dev_scaffold("x");
        m.sanitized = true;
        m.export_sanitization_profile = Some("sanitize_default".to_string());
        // missing version + summary
        assert!(validate_share_safe_export_manifest(&m).is_err());
    }
}

//! Collector binary. **`run`** exits without live loop; subcommands for dev verification.

use std::path::PathBuf;

use clap::{Parser, Subcommand};
use glass_collector::{
    build_fidelity_report, default_adapter_stack, ingest_procfs_raw_to_session_log,
    CollectorAdapter, CollectorConfig, PrivilegeMode, ProcfsProcessAdapter, RawObservation,
    SelfSilencePolicy,
};
use session_engine::{materialize_share_safe_procfs_pack_bytes, write_glass_pack, SessionManifest};

fn load_procfs_observations_for_cli(
    session: String,
    max_samples: usize,
    twice: bool,
    from_raw_json: Option<PathBuf>,
) -> Result<Vec<RawObservation>, String> {
    match from_raw_json {
        Some(path) => {
            let s = std::fs::read_to_string(&path)
                .map_err(|e| format!("read {}: {e}", path.display()))?;
            serde_json::from_str(&s).map_err(|e| format!("parse raw JSON: {e}"))
        }
        None => {
            if !cfg!(target_os = "linux") {
                return Err("on non-Linux use --from-raw-json or run on Linux.".to_string());
            }
            let mut a = ProcfsProcessAdapter::new(session);
            a.max_samples_per_poll = max_samples;
            let mut batch = a.poll_raw().map_err(|e| format!("poll: {e}"))?;
            if twice {
                match a.poll_raw() {
                    Ok(b2) => batch.extend(b2),
                    Err(e) => eprintln!("second poll: {e}"),
                }
            }
            Ok(batch)
        }
    }
}

fn exit_on_procfs_load_err(cmd: &str, err: String) -> ! {
    eprintln!("{cmd}: {err}");
    if err.contains("non-Linux") {
        std::process::exit(2);
    }
    std::process::exit(1);
}

#[derive(Parser, Debug)]
#[command(
    name = "glass-collector",
    version,
    about = "Glass Linux collector (Phase 2 — procfs lane; no eBPF)"
)]
struct Args {
    #[command(subcommand)]
    cmd: Option<Command>,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Print JSON fidelity / adapter capability report (stdout).
    Capabilities {
        /// Assume privileged mode for reporting (does not load eBPF).
        #[arg(long)]
        privileged: bool,
    },
    /// One-shot bounded `/proc` sample as JSON `RawObservation` array (Linux only; empty on other OS).
    SampleProcfs {
        #[arg(long, default_value = "glass-collector-sample")]
        session: String,
        #[arg(long, default_value_t = 512)]
        max_samples: usize,
        /// Run two polls to demonstrate poll-gap delta observations (Linux).
        #[arg(long, default_value_t = false)]
        twice: bool,
    },
    /// Procfs sample (or `--from-raw-json`), self-silence (default empty policy), normalize, write pack or print events JSON.
    NormalizeProcfs {
        #[arg(long, default_value = "glass-collector-norm")]
        session: String,
        #[arg(long, default_value_t = 512)]
        max_samples: usize,
        #[arg(long, default_value_t = false)]
        twice: bool,
        /// Output **unsanitized** `.glass_pack` (JSONL scaffold). Omit if `--events-json-stdout` only.
        #[arg(long)]
        output: Option<PathBuf>,
        #[arg(long, default_value_t = false)]
        events_json_stdout: bool,
        /// Read `RawObservation[]` JSON instead of polling (fixtures / non-Linux).
        #[arg(long)]
        from_raw_json: Option<PathBuf>,
    },
    /// Procfs → normalize → **share-safe** pack only (`sanitize_events_for_share` on the export lane; ingest path unchanged).
    ExportProcfsPack {
        #[arg(long, default_value = "glass-collector-export")]
        session: String,
        #[arg(long, default_value_t = 512)]
        max_samples: usize,
        #[arg(long, default_value_t = false)]
        twice: bool,
        /// Output `.glass_pack` with `sanitized: true` and redaction summary (Tier B–compatible).
        #[arg(long)]
        output: PathBuf,
        #[arg(long)]
        from_raw_json: Option<PathBuf>,
    },
}

fn main() {
    let args = Args::parse();
    match args.cmd {
        Some(Command::Capabilities { privileged }) => {
            let mode = if privileged {
                PrivilegeMode::Privileged
            } else {
                PrivilegeMode::Unprivileged
            };
            let adapters = default_adapter_stack();
            let report = build_fidelity_report(mode, &adapters);
            println!(
                "{}",
                serde_json::to_string_pretty(&report).expect("serialize fidelity report")
            );
            let _ = CollectorConfig::default();
        }
        Some(Command::SampleProcfs {
            session,
            max_samples,
            twice,
        }) => {
            if !cfg!(target_os = "linux") {
                eprintln!("sample-procfs: only available on Linux (/proc).");
                println!("[]");
                return;
            }
            let mut a = ProcfsProcessAdapter::new(session);
            a.max_samples_per_poll = max_samples;
            match a.poll_raw() {
                Ok(mut batch) => {
                    if twice {
                        match a.poll_raw() {
                            Ok(b2) => batch.extend(b2),
                            Err(e) => {
                                eprintln!("second poll: {e}");
                            }
                        }
                    }
                    println!(
                        "{}",
                        serde_json::to_string_pretty(&batch).expect("serialize observations")
                    );
                }
                Err(e) => {
                    eprintln!("sample-procfs: {e}");
                    std::process::exit(1);
                }
            }
        }
        Some(Command::NormalizeProcfs {
            session,
            max_samples,
            twice,
            output,
            events_json_stdout,
            from_raw_json,
        }) => {
            if !events_json_stdout && output.is_none() {
                eprintln!(
                    "normalize-procfs: specify --output PATH.glass_pack or --events-json-stdout"
                );
                std::process::exit(2);
            }
            let observations = match load_procfs_observations_for_cli(
                session.clone(),
                max_samples,
                twice,
                from_raw_json,
            ) {
                Ok(v) => v,
                Err(e) => exit_on_procfs_load_err("normalize-procfs", e),
            };

            let log =
                match ingest_procfs_raw_to_session_log(observations, &SelfSilencePolicy::default())
                {
                    Ok(l) => l,
                    Err(e) => {
                        eprintln!("normalize-procfs: session: {e}");
                        std::process::exit(1);
                    }
                };

            if events_json_stdout {
                println!(
                    "{}",
                    serde_json::to_string_pretty(log.events())
                        .expect("serialize normalized events")
                );
                return;
            }

            let out = output.expect("checked");
            let session_manifest = log
                .events()
                .first()
                .map(|e| e.session_id.as_str())
                .unwrap_or(session.as_str());
            let manifest = SessionManifest::procfs_poll_dev_scaffold(session_manifest);
            if let Err(e) = write_glass_pack(&out, &manifest, log.events()) {
                eprintln!("normalize-procfs: write pack: {e}");
                std::process::exit(1);
            }
            eprintln!(
                "normalize-procfs: wrote {} unsanitized event(s) to {}",
                log.len(),
                out.display()
            );
        }
        Some(Command::ExportProcfsPack {
            session,
            max_samples,
            twice,
            output,
            from_raw_json,
        }) => {
            let observations = match load_procfs_observations_for_cli(
                session.clone(),
                max_samples,
                twice,
                from_raw_json,
            ) {
                Ok(v) => v,
                Err(e) => exit_on_procfs_load_err("export-procfs-pack", e),
            };

            let log =
                match ingest_procfs_raw_to_session_log(observations, &SelfSilencePolicy::default())
                {
                    Ok(l) => l,
                    Err(e) => {
                        eprintln!("export-procfs-pack: session: {e}");
                        std::process::exit(1);
                    }
                };

            let session_id = log
                .events()
                .first()
                .map(|e| e.session_id.as_str())
                .unwrap_or(session.as_str());

            let bytes = match materialize_share_safe_procfs_pack_bytes(log.events(), session_id) {
                Ok(b) => b,
                Err(e) => {
                    eprintln!("export-procfs-pack: materialize: {e}");
                    std::process::exit(1);
                }
            };

            if let Err(e) = std::fs::write(&output, bytes) {
                eprintln!("export-procfs-pack: write {}: {e}", output.display());
                std::process::exit(1);
            }
            eprintln!(
                "export-procfs-pack: wrote {} share-safe sanitized event(s) to {}",
                log.len(),
                output.display()
            );
        }
        None => {
            eprintln!(
                "glass-collector {}: no live capture loop. Subcommands: `capabilities`, `sample-procfs`, `normalize-procfs`, `export-procfs-pack`.",
                env!("CARGO_PKG_VERSION")
            );
            eprintln!("Default invocation exits without emitting a long-running stream.");
            std::process::exit(2);
        }
    }
}

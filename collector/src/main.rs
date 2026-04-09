//! Collector binary. **`run`** exits without live loop; subcommands for dev verification.

use std::path::PathBuf;

use clap::{Parser, Subcommand};
use glass_collector::{
    build_fidelity_report, default_adapter_stack, ingest_procfs_raw_to_session_log,
    CollectorAdapter, CollectorConfig, PrivilegeMode, ProcfsProcessAdapter, SelfSilencePolicy,
};
use session_engine::{write_glass_pack, SessionManifest};

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
        /// Output `.glass_pack` (JSONL scaffold). Required unless `--events-json-stdout`.
        #[arg(long)]
        output: Option<PathBuf>,
        #[arg(long, default_value_t = false)]
        events_json_stdout: bool,
        /// Read `RawObservation[]` JSON instead of polling (fixtures / non-Linux).
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
            let observations = match from_raw_json {
                Some(path) => {
                    let s = std::fs::read_to_string(&path).unwrap_or_else(|e| {
                        eprintln!("normalize-procfs: read {}: {e}", path.display());
                        std::process::exit(1);
                    });
                    serde_json::from_str(&s).unwrap_or_else(|e| {
                        eprintln!("normalize-procfs: parse raw JSON: {e}");
                        std::process::exit(1);
                    })
                }
                None => {
                    if !cfg!(target_os = "linux") {
                        eprintln!(
                            "normalize-procfs: on non-Linux use --from-raw-json or run on Linux."
                        );
                        std::process::exit(2);
                    }
                    let mut a = ProcfsProcessAdapter::new(session.clone());
                    a.max_samples_per_poll = max_samples;
                    let mut batch = match a.poll_raw() {
                        Ok(b) => b,
                        Err(e) => {
                            eprintln!("normalize-procfs: poll: {e}");
                            std::process::exit(1);
                        }
                    };
                    if twice {
                        match a.poll_raw() {
                            Ok(b2) => batch.extend(b2),
                            Err(e) => eprintln!("normalize-procfs: second poll: {e}"),
                        }
                    }
                    batch
                }
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
                "normalize-procfs: wrote {} event(s) to {}",
                log.len(),
                out.display()
            );
        }
        None => {
            eprintln!(
                "glass-collector {}: no live capture loop. Subcommands: `capabilities`, `sample-procfs`, `normalize-procfs`.",
                env!("CARGO_PKG_VERSION")
            );
            eprintln!("Default invocation exits without emitting a long-running stream.");
            std::process::exit(2);
        }
    }
}

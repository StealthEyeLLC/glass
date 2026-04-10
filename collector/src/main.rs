//! Collector binary. **`run`** exits without live loop; subcommands for dev verification.

use std::path::PathBuf;
use std::time::Duration;

use clap::{Parser, Subcommand};
use std::sync::Arc;

use glass_collector::{
    build_fidelity_report, default_adapter_stack, ingest_file_lane_raw_to_session_log,
    ingest_procfs_raw_to_session_log, load_file_lane_observations_for_cli,
    load_procfs_observations_for_cli, run_ipc_dev_tcp_listener, spawn_retained_procfs_loop,
    CollectorAdapter, CollectorConfig, IpcDevTcpListenConfig, IpcDevTcpRuntime, PrivilegeMode,
    ProcfsProcessAdapter, ProcfsSnapshotFeedConfig, RetainedPollMeta, RetainedProcfsLoopConfig,
    SelfSilencePolicy, SnapshotStore,
};
use session_engine::{materialize_share_safe_procfs_pack_bytes, write_glass_pack, SessionManifest};

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
    /// Bounded directory poll under `--watch-root` as JSON `RawObservation` array (twice = second poll for gap semantics).
    SampleFileLane {
        #[arg(long)]
        watch_root: PathBuf,
        #[arg(long, default_value = "glass-collector-fs-sample")]
        session: String,
        #[arg(long, default_value_t = 512)]
        max_samples: usize,
        #[arg(long, default_value_t = 8)]
        max_depth: usize,
        #[arg(long, default_value_t = false)]
        twice: bool,
    },
    /// File-lane raw (live poll or `--from-raw-json`), normalize, write pack or print events JSON.
    NormalizeFileLane {
        #[arg(long)]
        watch_root: PathBuf,
        #[arg(long, default_value = "glass-collector-fs-norm")]
        session: String,
        #[arg(long, default_value_t = 512)]
        max_samples: usize,
        #[arg(long, default_value_t = 8)]
        max_depth: usize,
        #[arg(long, default_value_t = false)]
        twice: bool,
        #[arg(long)]
        output: Option<PathBuf>,
        #[arg(long, default_value_t = false)]
        events_json_stdout: bool,
        #[arg(long)]
        from_raw_json: Option<PathBuf>,
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
    /// **Provisional** F-IPC dev server (TCP loopback): versioned handshake + bounded snapshot RPC. Not final transport.
    IpcServe {
        #[arg(long, default_value = "127.0.0.1:9876")]
        listen: String,
        /// Shared secret for F-IPC (pair with bridge `--collector-ipc-secret`).
        #[arg(long)]
        shared_secret: String,
        /// Optional: load JSON array of event objects into this session id for demos/tests.
        #[arg(long)]
        seed_session: Option<String>,
        #[arg(long)]
        seed_events_json: Option<PathBuf>,
        /// When set, `BoundedSnapshotRequest` for this `session_id` is served from a **fresh** procfs poll
        /// (Linux) or `--procfs-from-raw-json` per RPC — real normalize path, bounded, **not** a live stream.
        #[arg(long)]
        procfs_session: Option<String>,
        #[arg(long, default_value_t = 512)]
        procfs_max_samples: usize,
        #[arg(long, default_value_t = false)]
        procfs_twice: bool,
        /// Read `RawObservation[]` instead of `/proc` (fixtures / non-Linux).
        #[arg(long)]
        procfs_from_raw_json: Option<PathBuf>,
        /// Background poll fills in-memory SnapshotStore for this session (bounded tail); F-IPC reads store (no per-RPC repoll). Not live deltas. Incompatible with `--procfs-session` for the same session id.
        #[arg(long)]
        procfs_retained_session: Option<String>,
        #[arg(long, default_value_t = 1000_u64)]
        procfs_retained_interval_ms: u64,
        #[arg(long, default_value_t = 256_usize)]
        procfs_retained_max_events: usize,
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
        Some(Command::SampleFileLane {
            watch_root,
            session,
            max_samples,
            max_depth,
            twice,
        }) => {
            let observations = match load_file_lane_observations_for_cli(
                session,
                watch_root,
                max_samples,
                max_depth,
                twice,
                None,
            ) {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("sample-file-lane: {e}");
                    std::process::exit(1);
                }
            };
            println!(
                "{}",
                serde_json::to_string_pretty(&observations).expect("serialize observations")
            );
        }
        Some(Command::NormalizeFileLane {
            watch_root,
            session,
            max_samples,
            max_depth,
            twice,
            output,
            events_json_stdout,
            from_raw_json,
        }) => {
            if !events_json_stdout && output.is_none() {
                eprintln!(
                    "normalize-file-lane: specify --output PATH.glass_pack or --events-json-stdout"
                );
                std::process::exit(2);
            }
            let observations = match load_file_lane_observations_for_cli(
                session.clone(),
                watch_root,
                max_samples,
                max_depth,
                twice,
                from_raw_json,
            ) {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("normalize-file-lane: {e}");
                    std::process::exit(1);
                }
            };
            let log = match ingest_file_lane_raw_to_session_log(
                observations,
                &SelfSilencePolicy::default(),
            ) {
                Ok(l) => l,
                Err(e) => {
                    eprintln!("normalize-file-lane: session: {e}");
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
                eprintln!("normalize-file-lane: write pack: {e}");
                std::process::exit(1);
            }
            eprintln!(
                "normalize-file-lane: wrote {} unsanitized event(s) to {}",
                log.len(),
                out.display()
            );
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
        Some(Command::IpcServe {
            listen,
            shared_secret,
            seed_session,
            seed_events_json,
            procfs_session,
            procfs_max_samples,
            procfs_twice,
            procfs_from_raw_json,
            procfs_retained_session,
            procfs_retained_interval_ms,
            procfs_retained_max_events,
        }) => {
            let bind: std::net::SocketAddr = listen.parse().unwrap_or_else(|e| {
                eprintln!("ipc-serve: invalid --listen: {e}");
                std::process::exit(2);
            });
            if !bind.ip().is_loopback() {
                eprintln!("ipc-serve: --listen must be loopback (provisional dev transport)");
                std::process::exit(2);
            }
            if procfs_session.is_some()
                && procfs_from_raw_json.is_none()
                && !cfg!(target_os = "linux")
            {
                eprintln!(
                    "ipc-serve: --procfs-session on non-Linux requires --procfs-from-raw-json"
                );
                std::process::exit(2);
            }
            if procfs_retained_session.is_some()
                && procfs_from_raw_json.is_none()
                && !cfg!(target_os = "linux")
            {
                eprintln!(
                    "ipc-serve: --procfs-retained-session on non-Linux requires --procfs-from-raw-json"
                );
                std::process::exit(2);
            }
            if let (Some(a), Some(b)) = (&procfs_session, &procfs_retained_session) {
                if a == b {
                    eprintln!(
                        "ipc-serve: --procfs-session and --procfs-retained-session must not use the same session id (pick per-RPC or retained mode)"
                    );
                    std::process::exit(2);
                }
            }
            let store = Arc::new(SnapshotStore::new());
            if let (Some(sid), Some(path)) = (seed_session, seed_events_json) {
                let raw = std::fs::read_to_string(&path).unwrap_or_else(|e| {
                    eprintln!("ipc-serve: read {}: {e}", path.display());
                    std::process::exit(1);
                });
                let events: Vec<serde_json::Value> =
                    serde_json::from_str(&raw).unwrap_or_else(|e| {
                        eprintln!("ipc-serve: parse seed JSON: {e}");
                        std::process::exit(1);
                    });
                store.set_session_events(sid, events);
            }
            let procfs_feed = procfs_session.map(|session_id| ProcfsSnapshotFeedConfig {
                session_id,
                max_samples: procfs_max_samples,
                twice: procfs_twice,
                from_raw_json: procfs_from_raw_json.clone(),
            });
            let mut retained_poll_meta = None;
            if let Some(rs) = procfs_retained_session {
                let feed = ProcfsSnapshotFeedConfig {
                    session_id: rs.clone(),
                    max_samples: procfs_max_samples,
                    twice: procfs_twice,
                    from_raw_json: procfs_from_raw_json.clone(),
                };
                let loop_cfg = RetainedProcfsLoopConfig {
                    feed,
                    interval: Duration::from_millis(procfs_retained_interval_ms),
                    max_retained_events: procfs_retained_max_events,
                };
                let meta = Arc::new(RetainedPollMeta::new(rs));
                let _join = spawn_retained_procfs_loop(store.clone(), loop_cfg, meta.clone());
                retained_poll_meta = Some(meta);
                eprintln!(
                    "ipc-serve: retained procfs loop → bounded SnapshotStore (not live ingest; interval {} ms)",
                    procfs_retained_interval_ms
                );
            }
            if procfs_feed.is_some() {
                eprintln!(
                    "ipc-serve: procfs-backed bounded snapshots for configured session (per-request poll+normalize; not live ingest)"
                );
            }
            eprintln!(
                "ipc-serve: provisional TCP F-IPC on {bind} (Ctrl+C stops the process if foreground)"
            );
            let cfg = IpcDevTcpListenConfig {
                bind,
                shared_secret: Arc::from(shared_secret.into_boxed_str()),
            };
            let runtime = Arc::new(IpcDevTcpRuntime {
                store,
                procfs_feed,
                retained_poll_meta,
            });
            if let Err(e) = run_ipc_dev_tcp_listener(cfg, runtime) {
                eprintln!("ipc-serve: {e}");
                std::process::exit(1);
            }
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
                "glass-collector {}: no live capture loop. Subcommands: `capabilities`, `sample-procfs`, `sample-file-lane`, `normalize-procfs`, `normalize-file-lane`, `export-procfs-pack`, `ipc-serve`.",
                env!("CARGO_PKG_VERSION")
            );
            eprintln!("Default invocation exits without emitting a long-running stream.");
            std::process::exit(2);
        }
    }
}

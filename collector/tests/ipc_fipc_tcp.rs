//! F-IPC provisional TCP: handshake + bounded snapshot (collector-owned store).

use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use glass_collector::ipc::{
    FipcBridgeToCollector, FipcCollectorToBridge, FIPC_SNAPSHOT_ORIGIN_PER_RPC_FILE_LANE,
    FIPC_SNAPSHOT_ORIGIN_PER_RPC_PROCFS, PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS,
    PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION, PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
};
use std::path::PathBuf;

use glass_collector::{
    handle_ipc_dev_tcp_connection, retained_file_lane_poll_tick, retained_procfs_poll_tick,
    run_ipc_dev_tcp_listener, AdapterId, FileLaneSnapshotFeedConfig, IpcDevTcpListenConfig,
    IpcDevTcpRuntime, ProcfsSnapshotFeedConfig, RawObservation, RawObservationKind,
    RawSourceQuality, RetainedPollMeta, SnapshotStore,
};

fn write_line(w: &mut impl Write, v: &impl serde::Serialize) -> std::io::Result<()> {
    let s = serde_json::to_string(v).unwrap();
    writeln!(w, "{s}")?;
    w.flush()?;
    Ok(())
}

fn read_line(r: &mut impl BufRead) -> String {
    let mut line = String::new();
    r.read_line(&mut line).unwrap();
    line.trim_end_matches(['\r', '\n']).to_string()
}

#[test]
fn fipc_handshake_success_and_bounded_snapshot() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let store = Arc::new(SnapshotStore::new());
    store.set_session_events(
        "ses_a",
        vec![serde_json::json!({"kind": "process_start", "seq": 1})],
    );
    let runtime = Arc::new(IpcDevTcpRuntime {
        store,
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("super-secret-fipc");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });

    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "super-secret-fipc".to_string(),
        },
    )
    .unwrap();
    let ack_line = read_line(&mut r);
    let ack: FipcCollectorToBridge = serde_json::from_str(&ack_line).unwrap();
    match ack {
        FipcCollectorToBridge::HelloAck { auth_token_version } => {
            assert_eq!(auth_token_version, PROVISIONAL_IPC_AUTH_TOKEN_VERSION);
        }
        _ => panic!("expected HelloAck, got {ack:?}"),
    }

    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "ses_a".to_string(),
            cursor: None,
            max_events: 10,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let snap_line = read_line(&mut r);
    let snap: FipcCollectorToBridge = serde_json::from_str(&snap_line).unwrap();
    match snap {
        FipcCollectorToBridge::BoundedSnapshotReply {
            session_id, events, ..
        } => {
            assert_eq!(session_id, "ses_a");
            assert_eq!(events.len(), 1);
        }
        _ => panic!("expected BoundedSnapshotReply, got {snap:?}"),
    }
}

#[test]
fn fipc_rejects_wire_protocol_mismatch() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("s");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        let _ = handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref());
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: 999,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "s".to_string(),
        },
    )
    .unwrap();
    let line = read_line(&mut r);
    let msg: FipcCollectorToBridge = serde_json::from_str(&line).unwrap();
    match msg {
        FipcCollectorToBridge::HelloReject { code, .. } => {
            assert_eq!(code, "wire_protocol_mismatch");
        }
        _ => panic!("expected HelloReject, got {msg:?}"),
    }
}

#[test]
fn fipc_rejects_auth_token_version_mismatch() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("s");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        let _ = handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref());
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: 99,
            shared_secret: "s".to_string(),
        },
    )
    .unwrap();
    let line = read_line(&mut r);
    let msg: FipcCollectorToBridge = serde_json::from_str(&line).unwrap();
    match msg {
        FipcCollectorToBridge::HelloReject { code, .. } => {
            assert_eq!(code, "auth_token_version_mismatch");
        }
        _ => panic!("expected HelloReject, got {msg:?}"),
    }
}

#[test]
fn fipc_rejects_shared_secret_mismatch() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("server-secret");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        let _ = handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref());
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "wrong".to_string(),
        },
    )
    .unwrap();
    let line = read_line(&mut r);
    let msg: FipcCollectorToBridge = serde_json::from_str(&line).unwrap();
    match msg {
        FipcCollectorToBridge::HelloReject { code, .. } => {
            assert_eq!(code, "shared_secret_mismatch");
        }
        _ => panic!("expected HelloReject, got {msg:?}"),
    }
}

#[test]
fn fipc_listener_accepts_connection() {
    let sock = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = sock.local_addr().unwrap();
    drop(sock);
    let cfg = IpcDevTcpListenConfig {
        bind: addr,
        shared_secret: Arc::from("x"),
    };
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    thread::spawn(move || {
        let _ = run_ipc_dev_tcp_listener(cfg, runtime);
    });
    thread::sleep(Duration::from_millis(40));
    // Connecting without handshake still accepted then dropped — smoke only.
    let _ = TcpStream::connect(addr);
}

fn file_lane_sample_raw(session: &str, seq: u64, rel: &str) -> RawObservation {
    RawObservation::new(
        seq,
        session,
        seq.saturating_mul(100),
        RawObservationKind::FileSeenInPollSnapshot,
        RawSourceQuality::DirectoryPollDerived,
        AdapterId::FsFileLane,
        serde_json::json!({
            "semantics": "bounded_directory_poll_snapshot",
            "relative_path": rel,
            "size_bytes": 1,
            "modified_unix_secs": 1,
            "poll_monotonic_ns": seq,
            "scan": { "files_seen_total": 1, "samples_returned": 1, "truncated_by_sample_budget": false, "state_budget_truncated": false, "max_depth": 4 },
            "watch_root": "/tmp/fipc-fixture",
            "first_poll_baseline": true,
        }),
    )
}

fn procfs_sample_raw(session: &str, seq: u64, pid: u32) -> RawObservation {
    RawObservation::new(
        seq,
        session,
        seq.saturating_mul(100),
        RawObservationKind::ProcessSample,
        RawSourceQuality::ProcfsDerived,
        AdapterId::ProcfsProcess,
        serde_json::json!({
            "semantics": "procfs_poll_snapshot",
            "pid": pid,
            "comm": "fixture",
            "ppid": 1,
        }),
    )
}

#[test]
fn fipc_procfs_raw_json_returns_normalized_bounded_snapshot() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("raw.json");
    let raw = vec![
        procfs_sample_raw("fipc_norm_sess", 1, 1001),
        procfs_sample_raw("fipc_norm_sess", 2, 1002),
    ];
    std::fs::write(&path, serde_json::to_string(&raw).unwrap()).unwrap();

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
        procfs_feed: Some(ProcfsSnapshotFeedConfig {
            session_id: "fipc_norm_sess".to_string(),
            max_samples: 512,
            twice: false,
            from_raw_json: Some(path),
        }),
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("sec-proc");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "sec-proc".to_string(),
        },
    )
    .unwrap();
    let _ack = read_line(&mut r);

    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "fipc_norm_sess".to_string(),
            cursor: None,
            max_events: 50,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let snap_line = read_line(&mut r);
    let snap: FipcCollectorToBridge = serde_json::from_str(&snap_line).unwrap();
    match snap {
        FipcCollectorToBridge::BoundedSnapshotReply {
            events,
            snapshot_cursor,
            live_session_ingest,
            ..
        } => {
            assert_eq!(events.len(), 2);
            assert_eq!(snapshot_cursor, "v0:off:2");
            assert!(!live_session_ingest);
            assert_eq!(events[0]["kind"], "process_poll_sample");
        }
        _ => panic!("expected BoundedSnapshotReply, got {snap:?}"),
    }
    let line_obj: serde_json::Value = serde_json::from_str(&snap_line).unwrap();
    assert!(!line_obj
        .as_object()
        .expect("object")
        .contains_key("retained_snapshot_unix_ms"));
}

#[test]
fn fipc_procfs_snapshot_clamped_by_request_max_events() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("raw.json");
    let raw = vec![
        procfs_sample_raw("fipc_clamp", 1, 1),
        procfs_sample_raw("fipc_clamp", 2, 2),
    ];
    std::fs::write(&path, serde_json::to_string(&raw).unwrap()).unwrap();

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
        procfs_feed: Some(ProcfsSnapshotFeedConfig {
            session_id: "fipc_clamp".to_string(),
            max_samples: 512,
            twice: false,
            from_raw_json: Some(path),
        }),
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("s");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "s".to_string(),
        },
    )
    .unwrap();
    let _ack = read_line(&mut r);
    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "fipc_clamp".to_string(),
            cursor: None,
            max_events: 1,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let snap_line = read_line(&mut r);
    let snap: FipcCollectorToBridge = serde_json::from_str(&snap_line).unwrap();
    match snap {
        FipcCollectorToBridge::BoundedSnapshotReply {
            events,
            snapshot_cursor,
            ..
        } => {
            assert_eq!(events.len(), 1);
            assert_eq!(snapshot_cursor, "v0:off:1");
        }
        _ => panic!("expected BoundedSnapshotReply, got {snap:?}"),
    }
}

#[test]
fn fipc_procfs_mismatched_session_uses_snapshot_store_only() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("raw.json");
    let raw = vec![procfs_sample_raw("proc_only", 1, 1)];
    std::fs::write(&path, serde_json::to_string(&raw).unwrap()).unwrap();

    let store = Arc::new(SnapshotStore::new());
    store.set_session_events(
        "store_sess",
        vec![serde_json::json!({"kind":"seed_only","n":1})],
    );
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store,
        procfs_feed: Some(ProcfsSnapshotFeedConfig {
            session_id: "proc_only".to_string(),
            max_samples: 512,
            twice: false,
            from_raw_json: Some(path),
        }),
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("s");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "s".to_string(),
        },
    )
    .unwrap();
    let _ack = read_line(&mut r);
    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "store_sess".to_string(),
            cursor: None,
            max_events: 10,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let snap_line = read_line(&mut r);
    let snap: FipcCollectorToBridge = serde_json::from_str(&snap_line).unwrap();
    match snap {
        FipcCollectorToBridge::BoundedSnapshotReply { events, .. } => {
            assert_eq!(events.len(), 1);
            assert_eq!(events[0]["kind"], "seed_only");
        }
        _ => panic!("expected BoundedSnapshotReply, got {snap:?}"),
    }
}

#[test]
fn fipc_procfs_empty_raw_array_honest_v0_empty() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("raw.json");
    std::fs::write(&path, "[]").unwrap();

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
        procfs_feed: Some(ProcfsSnapshotFeedConfig {
            session_id: "empty_sess".to_string(),
            max_samples: 512,
            twice: false,
            from_raw_json: Some(path),
        }),
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("s");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "s".to_string(),
        },
    )
    .unwrap();
    let _ack = read_line(&mut r);
    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "empty_sess".to_string(),
            cursor: None,
            max_events: 10,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let snap_line = read_line(&mut r);
    let snap: FipcCollectorToBridge = serde_json::from_str(&snap_line).unwrap();
    match snap {
        FipcCollectorToBridge::BoundedSnapshotReply {
            events,
            snapshot_cursor,
            snapshot_meta,
            ..
        } => {
            assert!(events.is_empty());
            assert_eq!(snapshot_cursor, "v0:empty");
            let meta = snapshot_meta.expect("F-04 bounded meta must be present");
            assert_eq!(meta.snapshot_origin, FIPC_SNAPSHOT_ORIGIN_PER_RPC_PROCFS);
        }
        _ => panic!("expected BoundedSnapshotReply, got {snap:?}"),
    }
}

#[test]
fn fipc_procfs_global_cap_matches_provisional_constant() {
    let mut obs = Vec::new();
    for i in 1..=257u64 {
        obs.push(procfs_sample_raw("cap_sess", i, i as u32));
    }
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("raw.json");
    std::fs::write(&path, serde_json::to_string(&obs).unwrap()).unwrap();

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
        procfs_feed: Some(ProcfsSnapshotFeedConfig {
            session_id: "cap_sess".to_string(),
            max_samples: 512,
            twice: false,
            from_raw_json: Some(path),
        }),
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("s");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "s".to_string(),
        },
    )
    .unwrap();
    let _ack = read_line(&mut r);
    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "cap_sess".to_string(),
            cursor: None,
            max_events: 10_000,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let snap_line = read_line(&mut r);
    let snap: FipcCollectorToBridge = serde_json::from_str(&snap_line).unwrap();
    match snap {
        FipcCollectorToBridge::BoundedSnapshotReply { events, .. } => {
            assert_eq!(events.len(), PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS);
        }
        _ => panic!("expected BoundedSnapshotReply, got {snap:?}"),
    }
}

#[test]
fn fipc_retained_store_snapshot_includes_retained_unix_ms() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("ret.json");
    let raw = vec![
        procfs_sample_raw("ret_ipc", 1, 9),
        procfs_sample_raw("ret_ipc", 2, 8),
    ];
    std::fs::write(&path, serde_json::to_string(&raw).unwrap()).unwrap();

    let store = Arc::new(SnapshotStore::new());
    let feed = ProcfsSnapshotFeedConfig {
        session_id: "ret_ipc".to_string(),
        max_samples: 512,
        twice: false,
        from_raw_json: Some(path),
    };
    let meta = Arc::new(RetainedPollMeta::new("ret_ipc"));
    retained_procfs_poll_tick(store.as_ref(), &feed, 256, Some(meta.as_ref())).unwrap();

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store,
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: Some(meta),
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("s");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "s".to_string(),
        },
    )
    .unwrap();
    let _ack = read_line(&mut r);
    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "ret_ipc".to_string(),
            cursor: None,
            max_events: 10,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let snap_line = read_line(&mut r);
    let snap: FipcCollectorToBridge = serde_json::from_str(&snap_line).unwrap();
    match snap {
        FipcCollectorToBridge::BoundedSnapshotReply {
            events,
            retained_snapshot_unix_ms,
            ..
        } => {
            assert_eq!(events.len(), 2);
            assert!(retained_snapshot_unix_ms.is_some());
        }
        _ => panic!("expected BoundedSnapshotReply, got {snap:?}"),
    }
}

#[test]
fn fipc_retained_meta_wrong_session_omits_retained_unix_ms() {
    let store = Arc::new(SnapshotStore::new());
    store.set_session_events("other", vec![serde_json::json!({"k":1})]);
    let meta = Arc::new(RetainedPollMeta::new("ret_only"));

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store,
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: Some(meta),
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("s");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "s".to_string(),
        },
    )
    .unwrap();
    let _ack = read_line(&mut r);
    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "other".to_string(),
            cursor: None,
            max_events: 10,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let snap_line = read_line(&mut r);
    let snap: FipcCollectorToBridge = serde_json::from_str(&snap_line).unwrap();
    match snap {
        FipcCollectorToBridge::BoundedSnapshotReply {
            retained_snapshot_unix_ms,
            ..
        } => {
            assert!(retained_snapshot_unix_ms.is_none());
        }
        _ => panic!("expected BoundedSnapshotReply, got {snap:?}"),
    }
}

#[test]
fn fipc_per_rpc_and_retained_sessions_independent() {
    let dir = tempfile::tempdir().unwrap();
    let p_ret = dir.path().join("ret.json");
    let p_rpc = dir.path().join("rpc.json");
    std::fs::write(
        &p_ret,
        serde_json::to_string(&vec![procfs_sample_raw("sess_ret", 1, 1)]).unwrap(),
    )
    .unwrap();
    std::fs::write(
        &p_rpc,
        serde_json::to_string(&vec![procfs_sample_raw("sess_rpc", 1, 2)]).unwrap(),
    )
    .unwrap();

    let store = Arc::new(SnapshotStore::new());
    let feed_ret = ProcfsSnapshotFeedConfig {
        session_id: "sess_ret".to_string(),
        max_samples: 512,
        twice: false,
        from_raw_json: Some(p_ret),
    };
    let meta = Arc::new(RetainedPollMeta::new("sess_ret"));
    retained_procfs_poll_tick(store.as_ref(), &feed_ret, 64, Some(meta.as_ref())).unwrap();

    let runtime = Arc::new(IpcDevTcpRuntime {
        store,
        procfs_feed: Some(ProcfsSnapshotFeedConfig {
            session_id: "sess_rpc".to_string(),
            max_samples: 512,
            twice: false,
            from_raw_json: Some(p_rpc),
        }),
        file_lane_feed: None,
        retained_poll_meta: Some(meta),
        file_lane_retained_poll_meta: None,
    });

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let secret = Arc::<str>::from("s");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "s".to_string(),
        },
    )
    .unwrap();
    let _ack = read_line(&mut r);

    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "sess_rpc".to_string(),
            cursor: None,
            max_events: 10,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let rpc_line = read_line(&mut r);
    let rpc_snap: FipcCollectorToBridge = serde_json::from_str(&rpc_line).unwrap();
    let FipcCollectorToBridge::BoundedSnapshotReply {
        events: rpc_ev,
        retained_snapshot_unix_ms: rpc_ret,
        ..
    } = rpc_snap
    else {
        panic!("expected reply");
    };
    assert_eq!(rpc_ev.len(), 1);
    assert!(rpc_ret.is_none());

    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "sess_ret".to_string(),
            cursor: None,
            max_events: 10,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let ret_line = read_line(&mut r);
    let ret_snap: FipcCollectorToBridge = serde_json::from_str(&ret_line).unwrap();
    let FipcCollectorToBridge::BoundedSnapshotReply {
        events: ret_ev,
        retained_snapshot_unix_ms: ret_ts,
        ..
    } = ret_snap
    else {
        panic!("expected reply");
    };
    assert_eq!(ret_ev.len(), 1);
    assert!(ret_ts.is_some());
}

#[test]
fn fipc_file_lane_fixture_returns_file_poll_snapshot() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("fl_raw.json");
    let raw = vec![file_lane_sample_raw("fipc_fl_sess", 1, "x.txt")];
    std::fs::write(&path, serde_json::to_string(&raw).unwrap()).unwrap();

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
        procfs_feed: None,
        file_lane_feed: Some(FileLaneSnapshotFeedConfig {
            session_id: "fipc_fl_sess".to_string(),
            watch_root: PathBuf::from("."),
            max_samples: 512,
            max_depth: 8,
            twice: false,
            from_raw_json: Some(path),
        }),
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("sec-fl");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "sec-fl".to_string(),
        },
    )
    .unwrap();
    let _ack = read_line(&mut r);
    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "fipc_fl_sess".to_string(),
            cursor: None,
            max_events: 50,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let snap_line = read_line(&mut r);
    let snap: FipcCollectorToBridge = serde_json::from_str(&snap_line).unwrap();
    match snap {
        FipcCollectorToBridge::BoundedSnapshotReply {
            events,
            snapshot_cursor,
            live_session_ingest,
            ..
        } => {
            assert_eq!(events.len(), 1);
            assert_eq!(snapshot_cursor, "v0:off:1");
            assert!(!live_session_ingest);
            assert_eq!(events[0]["kind"], "file_poll_snapshot");
        }
        _ => panic!("expected BoundedSnapshotReply, got {snap:?}"),
    }
}

#[test]
fn fipc_file_lane_empty_fixture_honest_v0_empty() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("empty_fl.json");
    std::fs::write(&path, "[]").unwrap();
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
        procfs_feed: None,
        file_lane_feed: Some(FileLaneSnapshotFeedConfig {
            session_id: "fl_empty".to_string(),
            watch_root: PathBuf::from("."),
            max_samples: 512,
            max_depth: 8,
            twice: false,
            from_raw_json: Some(path),
        }),
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("s");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "s".to_string(),
        },
    )
    .unwrap();
    let _ack = read_line(&mut r);
    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "fl_empty".to_string(),
            cursor: None,
            max_events: 10,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let snap_line = read_line(&mut r);
    let snap: FipcCollectorToBridge = serde_json::from_str(&snap_line).unwrap();
    match snap {
        FipcCollectorToBridge::BoundedSnapshotReply {
            events,
            snapshot_cursor,
            snapshot_meta,
            ..
        } => {
            assert!(events.is_empty());
            assert_eq!(snapshot_cursor, "v0:empty");
            let meta = snapshot_meta.expect("F-04 bounded meta must be present");
            assert_eq!(meta.snapshot_origin, FIPC_SNAPSHOT_ORIGIN_PER_RPC_FILE_LANE);
        }
        _ => panic!("expected BoundedSnapshotReply, got {snap:?}"),
    }
}

#[test]
fn fipc_procfs_and_file_lane_feeds_independent() {
    let dir = tempfile::tempdir().unwrap();
    let p_proc = dir.path().join("both_proc.json");
    let p_fl = dir.path().join("both_fl.json");
    std::fs::write(
        &p_proc,
        serde_json::to_string(&vec![procfs_sample_raw("sess_proc_only", 1, 99)]).unwrap(),
    )
    .unwrap();
    std::fs::write(
        &p_fl,
        serde_json::to_string(&vec![file_lane_sample_raw("sess_fl_only", 1, "a.txt")]).unwrap(),
    )
    .unwrap();

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
        procfs_feed: Some(ProcfsSnapshotFeedConfig {
            session_id: "sess_proc_only".to_string(),
            max_samples: 512,
            twice: false,
            from_raw_json: Some(p_proc),
        }),
        file_lane_feed: Some(FileLaneSnapshotFeedConfig {
            session_id: "sess_fl_only".to_string(),
            watch_root: PathBuf::from("."),
            max_samples: 512,
            max_depth: 8,
            twice: false,
            from_raw_json: Some(p_fl),
        }),
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("both");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "both".to_string(),
        },
    )
    .unwrap();
    let _ack = read_line(&mut r);

    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "sess_proc_only".to_string(),
            cursor: None,
            max_events: 10,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let l1 = read_line(&mut r);
    let s1: FipcCollectorToBridge = serde_json::from_str(&l1).unwrap();
    let FipcCollectorToBridge::BoundedSnapshotReply { events: e1, .. } = s1 else {
        panic!("expected reply");
    };
    assert_eq!(e1.len(), 1);
    assert_eq!(e1[0]["kind"], "process_poll_sample");

    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "sess_fl_only".to_string(),
            cursor: None,
            max_events: 10,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let l2 = read_line(&mut r);
    let s2: FipcCollectorToBridge = serde_json::from_str(&l2).unwrap();
    let FipcCollectorToBridge::BoundedSnapshotReply { events: e2, .. } = s2 else {
        panic!("expected reply");
    };
    assert_eq!(e2.len(), 1);
    assert_eq!(e2[0]["kind"], "file_poll_snapshot");
}

#[test]
fn fipc_file_lane_retained_snapshot_includes_retained_unix_ms() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("fl_ret.json");
    std::fs::write(
        &path,
        serde_json::to_string(&vec![file_lane_sample_raw("fl_ret_ipc", 1, "z.txt")]).unwrap(),
    )
    .unwrap();
    let feed = FileLaneSnapshotFeedConfig {
        session_id: "fl_ret_ipc".to_string(),
        watch_root: dir.path().to_path_buf(),
        max_samples: 512,
        max_depth: 8,
        twice: false,
        from_raw_json: Some(path),
    };
    let store = Arc::new(SnapshotStore::new());
    let meta = Arc::new(RetainedPollMeta::new("fl_ret_ipc"));
    retained_file_lane_poll_tick(store.as_ref(), &feed, 256, Some(meta.as_ref())).unwrap();

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store,
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: Some(meta),
    });
    let secret = Arc::<str>::from("s");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "s".to_string(),
        },
    )
    .unwrap();
    let _ack = read_line(&mut r);
    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "fl_ret_ipc".to_string(),
            cursor: None,
            max_events: 10,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let snap_line = read_line(&mut r);
    let snap: FipcCollectorToBridge = serde_json::from_str(&snap_line).unwrap();
    match snap {
        FipcCollectorToBridge::BoundedSnapshotReply {
            events,
            retained_snapshot_unix_ms,
            ..
        } => {
            assert_eq!(events.len(), 1);
            assert_eq!(events[0]["kind"], "file_poll_snapshot");
            assert!(retained_snapshot_unix_ms.is_some());
        }
        _ => panic!("expected BoundedSnapshotReply, got {snap:?}"),
    }
}

#[test]
fn fipc_procfs_retained_and_file_lane_retained_metas_independent() {
    let dir = tempfile::tempdir().unwrap();
    let p_proc = dir.path().join("pr.json");
    let p_fl = dir.path().join("fr.json");
    std::fs::write(
        &p_proc,
        serde_json::to_string(&vec![procfs_sample_raw("sess_pr", 1, 3)]).unwrap(),
    )
    .unwrap();
    std::fs::write(
        &p_fl,
        serde_json::to_string(&vec![file_lane_sample_raw("sess_fr", 1, "b.txt")]).unwrap(),
    )
    .unwrap();

    let feed_p = ProcfsSnapshotFeedConfig {
        session_id: "sess_pr".to_string(),
        max_samples: 512,
        twice: false,
        from_raw_json: Some(p_proc),
    };
    let feed_f = FileLaneSnapshotFeedConfig {
        session_id: "sess_fr".to_string(),
        watch_root: PathBuf::from("."),
        max_samples: 512,
        max_depth: 8,
        twice: false,
        from_raw_json: Some(p_fl),
    };
    let store = Arc::new(SnapshotStore::new());
    let meta_p = Arc::new(RetainedPollMeta::new("sess_pr"));
    let meta_f = Arc::new(RetainedPollMeta::new("sess_fr"));
    retained_procfs_poll_tick(store.as_ref(), &feed_p, 64, Some(meta_p.as_ref())).unwrap();
    retained_file_lane_poll_tick(store.as_ref(), &feed_f, 64, Some(meta_f.as_ref())).unwrap();

    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store,
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: Some(meta_p),
        file_lane_retained_poll_meta: Some(meta_f),
    });
    let secret = Arc::<str>::from("s");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), rt.as_ref()).unwrap();
    });
    thread::sleep(Duration::from_millis(30));
    let mut c = TcpStream::connect(addr).unwrap();
    let mut r = BufReader::new(c.try_clone().unwrap());
    write_line(
        &mut c,
        &FipcBridgeToCollector::Hello {
            wire_protocol_version: PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
            auth_token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
            shared_secret: "s".to_string(),
        },
    )
    .unwrap();
    let _ack = read_line(&mut r);

    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "sess_pr".to_string(),
            cursor: None,
            max_events: 10,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let l1 = read_line(&mut r);
    let s1: FipcCollectorToBridge = serde_json::from_str(&l1).unwrap();
    let FipcCollectorToBridge::BoundedSnapshotReply {
        events: e1,
        retained_snapshot_unix_ms: t1,
        ..
    } = s1
    else {
        panic!("expected reply");
    };
    assert_eq!(e1.len(), 1);
    assert_eq!(e1[0]["kind"], "process_poll_sample");
    assert!(t1.is_some());

    write_line(
        &mut c,
        &FipcBridgeToCollector::BoundedSnapshotRequest {
            session_id: "sess_fr".to_string(),
            cursor: None,
            max_events: 10,
            live_delta_tail_v0: None,
        },
    )
    .unwrap();
    let l2 = read_line(&mut r);
    let s2: FipcCollectorToBridge = serde_json::from_str(&l2).unwrap();
    let FipcCollectorToBridge::BoundedSnapshotReply {
        events: e2,
        retained_snapshot_unix_ms: t2,
        ..
    } = s2
    else {
        panic!("expected reply");
    };
    assert_eq!(e2.len(), 1);
    assert_eq!(e2[0]["kind"], "file_poll_snapshot");
    assert!(t2.is_some());
}

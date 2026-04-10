//! F-IPC provisional TCP: handshake + bounded snapshot (collector-owned store).

use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use glass_collector::ipc::{
    FipcBridgeToCollector, FipcCollectorToBridge, PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS,
    PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION, PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
};
use glass_collector::{
    handle_ipc_dev_tcp_connection, run_ipc_dev_tcp_listener, AdapterId, IpcDevTcpListenConfig,
    IpcDevTcpRuntime, ProcfsSnapshotFeedConfig, RawObservation, RawObservationKind,
    RawSourceQuality, SnapshotStore,
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
    });
    thread::spawn(move || {
        let _ = run_ipc_dev_tcp_listener(cfg, runtime);
    });
    thread::sleep(Duration::from_millis(40));
    // Connecting without handshake still accepted then dropped — smoke only.
    let _ = TcpStream::connect(addr);
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
            assert!(events.is_empty());
            assert_eq!(snapshot_cursor, "v0:empty");
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

//! F-IPC provisional TCP: handshake + bounded snapshot (collector-owned store).

use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use glass_collector::ipc::{
    FipcBridgeToCollector, FipcCollectorToBridge, PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
    PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
};
use glass_collector::{
    handle_ipc_dev_tcp_connection, run_ipc_dev_tcp_listener, IpcDevTcpListenConfig, SnapshotStore,
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
    let secret = Arc::<str>::from("super-secret-fipc");
    let st = store.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        handle_ipc_dev_tcp_connection(s, sec.as_ref(), st.as_ref()).unwrap();
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
    let store = Arc::new(SnapshotStore::new());
    let secret = Arc::<str>::from("s");
    let st = store.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        let _ = handle_ipc_dev_tcp_connection(s, sec.as_ref(), st.as_ref());
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
    let store = Arc::new(SnapshotStore::new());
    let secret = Arc::<str>::from("s");
    let st = store.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        let _ = handle_ipc_dev_tcp_connection(s, sec.as_ref(), st.as_ref());
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
    let store = Arc::new(SnapshotStore::new());
    let secret = Arc::<str>::from("server-secret");
    let st = store.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (s, _) = listener.accept().unwrap();
        let _ = handle_ipc_dev_tcp_connection(s, sec.as_ref(), st.as_ref());
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
    let store = Arc::new(SnapshotStore::new());
    thread::spawn(move || {
        let _ = run_ipc_dev_tcp_listener(cfg, store);
    });
    thread::sleep(Duration::from_millis(40));
    // Connecting without handshake still accepted then dropped — smoke only.
    let _ = TcpStream::connect(addr);
}

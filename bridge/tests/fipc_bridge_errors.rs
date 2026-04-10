//! F-IPC failure mapping on `GET /sessions/:id/snapshot` (503 JSON). Not bounded F-04 — additive operator detail only.

use std::net::TcpListener;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use glass_bridge::ipc_client::PROVISIONAL_FIPC_CONNECT_ATTEMPT_MAX;
use glass_bridge::{app_router, BridgeConfig, CollectorIpcClientConfig};
use glass_collector::{handle_ipc_dev_tcp_connection, IpcDevTcpRuntime, SnapshotStore};
use http_body_util::BodyExt;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tower::ServiceExt;

#[tokio::test]
async fn snapshot_503_auth_mismatch_is_distinct() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let store = Arc::new(SnapshotStore::new());
    store.set_session_events("s1", vec![]);
    let runtime = Arc::new(IpcDevTcpRuntime {
        store,
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("collector-secret");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (stream, _) = listener.accept().expect("accept");
        handle_ipc_dev_tcp_connection(stream, sec.as_ref(), rt.as_ref()).expect("handle");
    });
    thread::sleep(Duration::from_millis(40));

    let cfg = BridgeConfig {
        bind: "127.0.0.1:0".parse().unwrap(),
        bearer_token: Arc::from("bridge-token"),
        allow_non_loopback: false,
        collector_ipc: Some(CollectorIpcClientConfig {
            addr,
            shared_secret: Arc::from("wrong-bridge-secret"),
            timeout: Duration::from_secs(2),
        }),
        session_delta_wire_v0: false,
    };
    let app = app_router(&cfg);
    let res = app
        .oneshot(
            Request::builder()
                .uri("/sessions/s1/snapshot")
                .header("Authorization", "Bearer bridge-token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::SERVICE_UNAVAILABLE);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["error"], "collector_ipc_auth_mismatch");
    assert_eq!(v["handshake_code"], "shared_secret_mismatch");
}

#[tokio::test]
async fn snapshot_503_times_out_when_collector_never_replies_to_handshake() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        let (_sock, _) = listener.accept().await.expect("accepted");
        tokio::time::sleep(Duration::from_secs(120)).await;
    });
    tokio::time::sleep(Duration::from_millis(30)).await;

    let cfg = BridgeConfig {
        bind: "127.0.0.1:0".parse().unwrap(),
        bearer_token: Arc::from("t"),
        allow_non_loopback: false,
        collector_ipc: Some(CollectorIpcClientConfig {
            addr,
            shared_secret: Arc::from("s"),
            timeout: Duration::from_millis(400),
        }),
        session_delta_wire_v0: false,
    };
    let app = app_router(&cfg);
    let res = app
        .oneshot(
            Request::builder()
                .uri("/sessions/x/snapshot")
                .header("Authorization", "Bearer t")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::SERVICE_UNAVAILABLE);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["error"], "collector_ipc_timeout");
    assert_eq!(v["fipc_phase"], "fipc_read_handshake_line");
}

#[tokio::test]
async fn snapshot_503_malformed_handshake_json() {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        let (sock, _) = listener.accept().await.expect("accept");
        let mut buf = BufReader::new(sock);
        let mut line = String::new();
        let _ = buf.read_line(&mut line).await;
        let mut sock = buf.into_inner();
        let _ = sock.write_all(b"{not-json\n").await;
    });
    tokio::time::sleep(Duration::from_millis(30)).await;

    let cfg = BridgeConfig {
        bind: "127.0.0.1:0".parse().unwrap(),
        bearer_token: Arc::from("t"),
        allow_non_loopback: false,
        collector_ipc: Some(CollectorIpcClientConfig {
            addr,
            shared_secret: Arc::from("s"),
            timeout: Duration::from_secs(2),
        }),
        session_delta_wire_v0: false,
    };
    let app = app_router(&cfg);
    let res = app
        .oneshot(
            Request::builder()
                .uri("/sessions/x/snapshot")
                .header("Authorization", "Bearer t")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::SERVICE_UNAVAILABLE);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["error"], "collector_ipc_malformed_response");
}

/// Ensures the documented cap constant stays in sync with client behavior (compile-time anchor for operators).
#[test]
fn provisional_connect_cap_is_non_zero() {
    assert!(PROVISIONAL_FIPC_CONNECT_ATTEMPT_MAX.as_secs() >= 1);
}

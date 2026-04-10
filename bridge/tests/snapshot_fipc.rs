//! `GET /sessions/:id/snapshot` backed by collector F-IPC (provisional TCP).

use std::net::TcpListener;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use glass_bridge::http_types::SNAPSHOT_CURSOR_EMPTY;
use glass_bridge::{app_router, BridgeConfig, CollectorIpcClientConfig};
use glass_collector::ipc::PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION;
use glass_collector::{handle_ipc_dev_tcp_connection, SnapshotStore};
use http_body_util::BodyExt;
use tower::ServiceExt;

#[tokio::test]
async fn snapshot_populated_via_collector_fipc() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let store = Arc::new(SnapshotStore::new());
    store.set_session_events(
        "ses_fipc",
        vec![serde_json::json!({"kind":"process_start","seq":1})],
    );
    let secret = Arc::<str>::from("fipc-test-secret");
    let st = store.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (stream, _) = listener.accept().expect("accept");
        handle_ipc_dev_tcp_connection(stream, sec.as_ref(), st.as_ref()).expect("handle");
    });
    thread::sleep(Duration::from_millis(40));

    let cfg = BridgeConfig {
        bind: "127.0.0.1:0".parse().unwrap(),
        bearer_token: Arc::from("bridge-http-token"),
        allow_non_loopback: false,
        collector_ipc: Some(CollectorIpcClientConfig {
            addr,
            shared_secret: secret,
            timeout: Duration::from_secs(2),
        }),
    };
    let app = app_router(&cfg);
    let res = app
        .oneshot(
            Request::builder()
                .uri("/sessions/ses_fipc/snapshot")
                .header("Authorization", "Bearer bridge-http-token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["session_id"], "ses_fipc");
    assert_eq!(v["snapshot_cursor"], "v0:off:1");
    assert_eq!(v["events"].as_array().unwrap().len(), 1);
    assert_eq!(v["collector_ipc"]["status"], "ok");
    assert_eq!(v["collector_ipc"]["transport"], "provisional_tcp_loopback");
}

#[tokio::test]
async fn capabilities_shows_fipc_configured() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    drop(listener);

    let cfg = BridgeConfig {
        bind: "127.0.0.1:0".parse().unwrap(),
        bearer_token: Arc::from("t"),
        allow_non_loopback: false,
        collector_ipc: Some(CollectorIpcClientConfig {
            addr,
            shared_secret: Arc::from("s"),
            timeout: Duration::from_secs(1),
        }),
    };
    let app = app_router(&cfg);
    let res = app
        .oneshot(
            Request::builder()
                .uri("/capabilities")
                .header("Authorization", "Bearer t")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["collector_fipc"]["configured"], true);
    assert_eq!(
        v["collector_fipc"]["wire_protocol_version"],
        PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION
    );
}

#[tokio::test]
async fn empty_session_snapshot_cursor_via_fipc() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let store = Arc::new(SnapshotStore::new());
    let secret = Arc::<str>::from("sec");
    let st = store.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (stream, _) = listener.accept().expect("accept");
        let _ = handle_ipc_dev_tcp_connection(stream, sec.as_ref(), st.as_ref());
    });
    thread::sleep(Duration::from_millis(40));

    let cfg = BridgeConfig {
        bind: "127.0.0.1:0".parse().unwrap(),
        bearer_token: Arc::from("t"),
        allow_non_loopback: false,
        collector_ipc: Some(CollectorIpcClientConfig {
            addr,
            shared_secret: secret,
            timeout: Duration::from_secs(2),
        }),
    };
    let app = app_router(&cfg);
    let res = app
        .oneshot(
            Request::builder()
                .uri("/sessions/unknown_session/snapshot")
                .header("Authorization", "Bearer t")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["snapshot_cursor"], SNAPSHOT_CURSOR_EMPTY);
    assert_eq!(v["events"].as_array().unwrap().len(), 0);
}

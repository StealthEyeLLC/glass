//! HTTP/WebSocket route contract tests (no live ingest; no collector).

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use futures_util::StreamExt;
use glass_bridge::http_types::SNAPSHOT_CURSOR_EMPTY;
use glass_bridge::resync::PROVISIONAL_BACKLOG_EVENT_THRESHOLD;
use glass_bridge::{app_router, serve_listener, BridgeConfig, BridgeConfigError};
use http_body_util::BodyExt;
use tokio::net::TcpListener;
use tokio_tungstenite::connect_async;
use tower::ServiceExt;

fn test_config() -> BridgeConfig {
    BridgeConfig {
        bind: "127.0.0.1:0".parse().unwrap(),
        bearer_token: Arc::from("test-secret-token"),
        allow_non_loopback: false,
    }
}

#[tokio::test]
async fn health_requires_no_auth() {
    let app = app_router(&test_config());
    let res = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["status"], "ok");
    assert_eq!(v["service"], "glass_bridge");
}

#[tokio::test]
async fn capabilities_rejects_missing_bearer() {
    let app = app_router(&test_config());
    let res = app
        .oneshot(
            Request::builder()
                .uri("/capabilities")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn capabilities_accepts_valid_bearer() {
    let app = app_router(&test_config());
    let res = app
        .oneshot(
            Request::builder()
                .uri("/capabilities")
                .header("Authorization", "Bearer test-secret-token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["bridge_api_version"], 1);
    assert_eq!(
        v["resync"]["provisional_backlog_event_threshold"],
        PROVISIONAL_BACKLOG_EVENT_THRESHOLD
    );
    assert_eq!(v["resync"]["recovery_strategy"], "snapshot_and_cursor");
    assert_eq!(v["live_session_ingest"], false);
    assert_eq!(
        v["websocket"]["delta_stream_status"],
        "handshake_only_no_live_deltas"
    );
}

#[tokio::test]
async fn snapshot_requires_bearer_and_returns_bounded_shape() {
    let app = app_router(&test_config());
    let res = app
        .oneshot(
            Request::builder()
                .uri("/sessions/ses_demo/snapshot?cursor=v0:0")
                .header("Authorization", "Bearer test-secret-token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["session_id"], "ses_demo");
    assert_eq!(v["cursor_requested"], "v0:0");
    assert_eq!(v["snapshot_cursor"], SNAPSHOT_CURSOR_EMPTY);
    assert_eq!(v["events"], serde_json::json!([]));
    assert_eq!(v["live_session_ingest"], false);
    assert!(v["resync_hint"].is_null());
}

#[tokio::test]
async fn config_rejects_non_loopback_without_opt_in() {
    let cfg = BridgeConfig {
        bind: SocketAddr::from(([0, 0, 0, 0], 9781)),
        bearer_token: Arc::from("t"),
        allow_non_loopback: false,
    };
    let e = cfg.validate().unwrap_err();
    assert!(matches!(e, BridgeConfigError::LoopbackOnly));
}

#[tokio::test]
async fn config_allows_non_loopback_when_flag_set() {
    let cfg = BridgeConfig {
        bind: SocketAddr::from(([0, 0, 0, 0], 9781)),
        bearer_token: Arc::from("t"),
        allow_non_loopback: true,
    };
    assert!(cfg.validate().is_ok());
}

#[tokio::test]
async fn ws_plain_get_without_upgrade_headers_is_bad_request() {
    let app = app_router(&test_config());
    let res = app
        .oneshot(Request::builder().uri("/ws").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

async fn spawn_test_server() -> SocketAddr {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let cfg = BridgeConfig {
        bind: addr,
        bearer_token: Arc::from("test-secret-token"),
        allow_non_loopback: false,
    };
    tokio::spawn({
        let cfg = cfg.clone();
        async move {
            let _ = serve_listener(listener, &cfg).await;
        }
    });
    tokio::time::sleep(Duration::from_millis(50)).await;
    addr
}

#[tokio::test]
async fn ws_handshake_fails_without_credentials() {
    let addr = spawn_test_server().await;
    let url = format!("ws://127.0.0.1:{}/ws", addr.port());
    let err = connect_async(url)
        .await
        .expect_err("expected handshake failure");
    let s = err.to_string();
    assert!(
        s.contains("401") || s.contains("Unauthorized"),
        "unexpected error: {err}"
    );
}

#[tokio::test]
async fn ws_handshake_with_query_token_receives_hello_json() {
    let addr = spawn_test_server().await;
    let url = format!(
        "ws://127.0.0.1:{}/ws?access_token=test-secret-token",
        addr.port()
    );
    let (mut ws, _) = connect_async(url).await.expect("handshake");
    let msg = ws.next().await.expect("message").expect("ok message");
    let tokio_tungstenite::tungstenite::Message::Text(t) = msg else {
        panic!("expected text, got {msg:?}");
    };
    let v: serde_json::Value = serde_json::from_str(&t).unwrap();
    assert_eq!(v["type"], "glass.bridge.ws.hello");
    assert_eq!(v["live_delta_stream"], false);
    assert_eq!(v["recovery_strategy"], "snapshot_and_cursor");
    let _ = ws.close(None).await;
}

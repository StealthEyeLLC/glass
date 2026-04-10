//! WebSocket live-session skeleton (F-IPC polling). Does not replace frozen HTTP snapshot contract.

use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use futures_util::{SinkExt, StreamExt};
use glass_bridge::ipc_client::fetch_bounded_snapshot;
use glass_bridge::live_session_ws::{
    F03_V0_LIVE_WS_QUEUE_MAX_BYTES, F03_V0_LIVE_WS_QUEUE_MAX_EVENTS, LIVE_SESSION_WS_PROTOCOL_V1,
};
use glass_bridge::resync::{
    RESYNC_HINT_REASON_BOUNDED_TRUNCATION, RESYNC_HINT_REASON_RETAINED_TAIL_REPLACES,
};
use glass_bridge::{app_router, BridgeConfig, CollectorIpcClientConfig};
use glass_collector::ipc::FipcCollectorToBridge;
use glass_collector::{
    handle_ipc_dev_tcp_connection, retained_file_lane_poll_tick, AdapterId,
    FileLaneSnapshotFeedConfig, IpcDevTcpRuntime, RawObservation, RawObservationKind,
    RawSourceQuality, RetainedPollMeta, SnapshotStore,
};
use http_body_util::BodyExt;
use tokio::time::timeout;
use tokio_tungstenite::connect_async;
use tower::ServiceExt;

fn file_lane_obs(seq: u64, path: &str) -> RawObservation {
    RawObservation::new(
        seq,
        "ws_live_sess",
        10u64 + seq,
        RawObservationKind::FileSeenInPollSnapshot,
        RawSourceQuality::DirectoryPollDerived,
        AdapterId::FsFileLane,
        serde_json::json!({
            "semantics": "bounded_directory_poll_snapshot",
            "relative_path": path,
            "size_bytes": 1,
            "modified_unix_secs": seq,
            "poll_monotonic_ns": 10 + seq,
            "scan": { "files_seen_total": 1, "samples_returned": 1, "truncated_by_sample_budget": false, "state_budget_truncated": false, "max_depth": 4 },
            "watch_root": "/tmp/ws-fl",
            "first_poll_baseline": seq == 1,
        }),
    )
}

#[tokio::test]
async fn capabilities_reflects_live_session_skeleton_when_fipc_configured() {
    let cfg = BridgeConfig {
        bind: "127.0.0.1:0".parse().unwrap(),
        bearer_token: Arc::from("t"),
        allow_non_loopback: false,
        collector_ipc: Some(CollectorIpcClientConfig {
            addr: "127.0.0.1:9".parse().unwrap(),
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
    assert_eq!(v["websocket"]["live_session_delta_skeleton"], true);
    assert_eq!(
        v["websocket"]["delta_stream_status"],
        "live_session_delta_skeleton_polling"
    );
}

#[tokio::test]
async fn retained_file_lane_change_emits_session_snapshot_replaced() {
    std::env::set_var("GLASS_BRIDGE_LIVE_WS_POLL_MS", "40");

    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("fl1.json");
    let o1 = file_lane_obs(1, "a.txt");
    std::fs::write(&path, serde_json::to_string(&vec![o1]).unwrap()).unwrap();

    let store = Arc::new(SnapshotStore::new());
    let feed = FileLaneSnapshotFeedConfig {
        session_id: "ws_live_sess".to_string(),
        watch_root: PathBuf::from("."),
        max_samples: 512,
        max_depth: 8,
        twice: false,
        from_raw_json: Some(path.clone()),
    };
    let meta = Arc::new(RetainedPollMeta::new("ws_live_sess"));
    retained_file_lane_poll_tick(store.as_ref(), &feed, 256, Some(meta.as_ref())).unwrap();

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store,
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: Some(meta),
    });
    let secret = Arc::<str>::from("ws-live-secret");
    let rt_loop = runtime.clone();
    let sec_loop = secret.clone();
    // One accept() is not enough: bridge live polling opens many short F-IPC TCP connections.
    thread::spawn(move || loop {
        let Ok((stream, _)) = listener.accept() else {
            break;
        };
        let rt = rt_loop.clone();
        let sec = sec_loop.clone();
        thread::spawn(move || {
            let _ = handle_ipc_dev_tcp_connection(stream, sec.as_ref(), rt.as_ref());
        });
    });
    thread::sleep(Duration::from_millis(40));

    let listener_b = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let baddr = listener_b.local_addr().unwrap();
    let bridge_cfg = BridgeConfig {
        bind: baddr,
        bearer_token: Arc::from("bridge-ws-token"),
        allow_non_loopback: false,
        collector_ipc: Some(CollectorIpcClientConfig {
            addr,
            shared_secret: secret.clone(),
            timeout: Duration::from_secs(3),
        }),
    };
    let cfg_clone = bridge_cfg.clone();
    tokio::spawn(async move {
        let _ = glass_bridge::serve_listener(listener_b, &cfg_clone).await;
    });
    tokio::time::sleep(Duration::from_millis(80)).await;

    let url = format!(
        "ws://127.0.0.1:{}/ws?access_token=bridge-ws-token",
        baddr.port()
    );
    let (mut ws, _) = connect_async(url).await.expect("ws connect");

    let msg = ws.next().await.expect("hello").expect("ok");
    let tokio_tungstenite::tungstenite::Message::Text(t) = msg else {
        panic!("expected text");
    };
    let hello: serde_json::Value = serde_json::from_str(&t).unwrap();
    assert_eq!(hello["type"], "glass.bridge.ws.hello");
    assert_eq!(hello["live_session_delta_skeleton"], true);
    assert_eq!(hello["collector_fipc_configured"], true);
    let f03 = &hello["f03_v0_live_ws"];
    assert_eq!(
        f03["queue_max_events"].as_u64().unwrap() as usize,
        F03_V0_LIVE_WS_QUEUE_MAX_EVENTS
    );
    assert_eq!(
        f03["queue_max_bytes"].as_u64().unwrap() as usize,
        F03_V0_LIVE_WS_QUEUE_MAX_BYTES
    );
    assert_eq!(
        f03["overflow_policy"].as_str().unwrap(),
        "coalesce_latest_session_snapshot_replaced_then_session_resync_required"
    );
    assert_eq!(
        f03["threshold_semantics"].as_str().unwrap(),
        "events_or_bytes"
    );

    let sub = serde_json::json!({
        "msg": "live_session_subscribe",
        "session_id": "ws_live_sess",
        "protocol": LIVE_SESSION_WS_PROTOCOL_V1
    });
    ws.send(tokio_tungstenite::tungstenite::Message::Text(
        sub.to_string().into(),
    ))
    .await
    .unwrap();

    let msg = ws.next().await.expect("session_hello").expect("ok");
    let tokio_tungstenite::tungstenite::Message::Text(t) = msg else {
        panic!("expected text");
    };
    let sh: serde_json::Value = serde_json::from_str(&t).unwrap();
    assert_eq!(sh["type"], "glass.bridge.live_session.v1");
    assert_eq!(sh["msg"], "session_hello");
    assert_eq!(sh["session_id"], "ws_live_sess");

    // Deterministic: mutate the collector store directly (same process) to simulate a retained
    // tail replacement — avoids flaking on second directory-poll ingest timing.
    runtime.store.set_session_events(
        "ws_live_sess",
        vec![
            serde_json::json!({"kind": "file_poll_snapshot", "seq": 1, "note": "ws_test"}),
            serde_json::json!({"kind": "file_poll_snapshot", "seq": 2, "note": "ws_test"}),
        ],
    );

    let ipc_check = fetch_bounded_snapshot(
        addr,
        secret.as_ref(),
        "ws_live_sess",
        None,
        256,
        Duration::from_secs(2),
    )
    .await
    .expect("direct F-IPC fetch");
    match ipc_check {
        FipcCollectorToBridge::BoundedSnapshotReply { events, .. } => {
            assert_eq!(
                events.len(),
                2,
                "collector store must reflect mutation for WS poll"
            );
        }
        _ => panic!("unexpected F-IPC reply"),
    }

    let got = timeout(Duration::from_secs(6), async {
        while let Some(m) = ws.next().await {
            let Ok(m) = m else { break };
            let tokio_tungstenite::tungstenite::Message::Text(t) = m else {
                continue;
            };
            let Ok(v) = serde_json::from_str::<serde_json::Value>(&t) else {
                continue;
            };
            if v["msg"] == "session_snapshot_replaced" {
                return Some(v);
            }
        }
        None
    })
    .await
    .expect("timeout")
    .expect("expected session_snapshot_replaced");

    assert_eq!(got["session_id"], "ws_live_sess");
    assert_eq!(got["continuity"], "bounded_replacement_not_append_only");
    assert_eq!(got["snapshot_origin"], "collector_store");
    assert!(got["retained_snapshot_unix_ms"].as_u64().is_some());
    let sample = got["events_sample"].as_array().expect("sample");
    assert!(!sample.is_empty());

    let _ = ws.close(None).await;

    std::env::remove_var("GLASS_BRIDGE_LIVE_WS_POLL_MS");
}

#[tokio::test]
async fn http_snapshot_still_matches_frozen_bounded_contract_after_ws_branch() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let store = Arc::new(SnapshotStore::new());
    store.set_session_events("freeze_chk", vec![serde_json::json!({"kind":"x","seq":1})]);
    let runtime = Arc::new(IpcDevTcpRuntime {
        store,
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("sec");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (stream, _) = listener.accept().expect("accept");
        handle_ipc_dev_tcp_connection(stream, sec.as_ref(), rt.as_ref()).expect("h");
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
                .uri("/sessions/freeze_chk/snapshot")
                .header("Authorization", "Bearer t")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["snapshot_cursor"], "v0:off:1");
    assert_eq!(v["bounded_snapshot"]["snapshot_origin"], "collector_store");
    assert!(v["resync_hint"].is_null());
    assert!(
        !RESYNC_HINT_REASON_BOUNDED_TRUNCATION.is_empty()
            && !RESYNC_HINT_REASON_RETAINED_TAIL_REPLACES.is_empty()
    );
    assert_eq!(v["live_session_ingest"], false);
    assert_eq!(v["collector_ipc"]["status"], "ok");
}

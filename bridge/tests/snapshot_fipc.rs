//! `GET /sessions/:id/snapshot` backed by collector F-IPC (provisional TCP).

use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use glass_bridge::http_types::SNAPSHOT_CURSOR_EMPTY;
use glass_bridge::{app_router, BridgeConfig, CollectorIpcClientConfig};
use glass_collector::ipc::PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION;
use glass_collector::{
    handle_ipc_dev_tcp_connection, retained_file_lane_poll_tick, retained_procfs_poll_tick,
    AdapterId, FileLaneSnapshotFeedConfig, IpcDevTcpRuntime, ProcfsSnapshotFeedConfig,
    RawObservation, RawObservationKind, RawSourceQuality, RetainedPollMeta, SnapshotStore,
};
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
    let runtime = Arc::new(IpcDevTcpRuntime {
        store,
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("fipc-test-secret");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (stream, _) = listener.accept().expect("accept");
        handle_ipc_dev_tcp_connection(stream, sec.as_ref(), rt.as_ref()).expect("handle");
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
    assert_eq!(v["bounded_snapshot"]["snapshot_origin"], "collector_store");
    assert_eq!(
        v["bounded_snapshot"]["cursor_semantics"],
        "bounded_prefix_v0"
    );
    assert!(v["resync_hint"].is_null());
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
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
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
        let _ = handle_ipc_dev_tcp_connection(stream, sec.as_ref(), rt.as_ref());
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
    assert_eq!(v["bounded_snapshot"]["snapshot_origin"], "unknown_or_empty");
    assert!(v["resync_hint"].is_null());
}

#[tokio::test]
async fn snapshot_via_procfs_fixture_normalized_envelope() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("raw.json");
    let o = RawObservation::new(
        1,
        "bridge_procfs_sess",
        10,
        RawObservationKind::ProcessSample,
        RawSourceQuality::ProcfsDerived,
        AdapterId::ProcfsProcess,
        serde_json::json!({
            "semantics": "procfs_poll_snapshot",
            "pid": 4242,
            "comm": "bridge-fixture",
            "ppid": 1,
        }),
    );
    std::fs::write(&path, serde_json::to_string(&vec![o]).unwrap()).unwrap();

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
        procfs_feed: Some(ProcfsSnapshotFeedConfig {
            session_id: "bridge_procfs_sess".to_string(),
            max_samples: 512,
            twice: false,
            from_raw_json: Some(path),
        }),
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("bridge-procfs-ipc-secret");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (stream, _) = listener.accept().expect("accept");
        handle_ipc_dev_tcp_connection(stream, sec.as_ref(), rt.as_ref()).expect("handle");
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
                .uri("/sessions/bridge_procfs_sess/snapshot")
                .header("Authorization", "Bearer bridge-http-token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["session_id"], "bridge_procfs_sess");
    let events = v["events"].as_array().unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0]["kind"], "process_poll_sample");
    assert_eq!(v["snapshot_cursor"], "v0:off:1");
    assert_eq!(v["collector_ipc"]["status"], "ok");
    assert_eq!(
        v["resync_hint"]["reason"],
        "per_rpc_poll_snapshot_not_incremental"
    );
    assert_eq!(v["bounded_snapshot"]["snapshot_origin"], "per_rpc_procfs");
}

#[tokio::test]
async fn snapshot_via_file_lane_fixture_normalized_envelope() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("fl_raw.json");
    let o = RawObservation::new(
        1,
        "bridge_file_lane_sess",
        10,
        RawObservationKind::FileSeenInPollSnapshot,
        RawSourceQuality::DirectoryPollDerived,
        AdapterId::FsFileLane,
        serde_json::json!({
            "semantics": "bounded_directory_poll_snapshot",
            "relative_path": "fixture.txt",
            "size_bytes": 2,
            "modified_unix_secs": 1,
            "poll_monotonic_ns": 10,
            "scan": { "files_seen_total": 1, "samples_returned": 1, "truncated_by_sample_budget": false, "state_budget_truncated": false, "max_depth": 4 },
            "watch_root": "/tmp/bridge-fl",
            "first_poll_baseline": true,
        }),
    );
    std::fs::write(&path, serde_json::to_string(&vec![o]).unwrap()).unwrap();

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store: Arc::new(SnapshotStore::new()),
        procfs_feed: None,
        file_lane_feed: Some(FileLaneSnapshotFeedConfig {
            session_id: "bridge_file_lane_sess".to_string(),
            watch_root: PathBuf::from("."),
            max_samples: 512,
            max_depth: 8,
            twice: false,
            from_raw_json: Some(path),
        }),
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("bridge-fl-ipc-secret");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (stream, _) = listener.accept().expect("accept");
        handle_ipc_dev_tcp_connection(stream, sec.as_ref(), rt.as_ref()).expect("handle");
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
                .uri("/sessions/bridge_file_lane_sess/snapshot")
                .header("Authorization", "Bearer bridge-http-token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["session_id"], "bridge_file_lane_sess");
    let events = v["events"].as_array().unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0]["kind"], "file_poll_snapshot");
    assert_eq!(v["snapshot_cursor"], "v0:off:1");
    assert_eq!(v["live_session_ingest"], false);
    assert_eq!(v["collector_ipc"]["status"], "ok");
    assert_eq!(
        v["resync_hint"]["reason"],
        "per_rpc_poll_snapshot_not_incremental"
    );
    assert_eq!(
        v["bounded_snapshot"]["snapshot_origin"],
        "per_rpc_file_lane"
    );
}

#[tokio::test]
async fn snapshot_file_lane_retained_includes_retained_unix_ms() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("br_fl_ret.json");
    let o = RawObservation::new(
        1,
        "bridge_fl_retained_sess",
        12,
        RawObservationKind::FileSeenInPollSnapshot,
        RawSourceQuality::DirectoryPollDerived,
        AdapterId::FsFileLane,
        serde_json::json!({
            "semantics": "bounded_directory_poll_snapshot",
            "relative_path": "r.txt",
            "size_bytes": 1,
            "modified_unix_secs": 1,
            "poll_monotonic_ns": 12,
            "scan": { "files_seen_total": 1, "samples_returned": 1, "truncated_by_sample_budget": false, "state_budget_truncated": false, "max_depth": 4 },
            "watch_root": "/tmp/br-fl-ret",
            "first_poll_baseline": true,
        }),
    );
    std::fs::write(&path, serde_json::to_string(&vec![o]).unwrap()).unwrap();

    let store = Arc::new(SnapshotStore::new());
    let feed = FileLaneSnapshotFeedConfig {
        session_id: "bridge_fl_retained_sess".to_string(),
        watch_root: PathBuf::from("."),
        max_samples: 512,
        max_depth: 8,
        twice: false,
        from_raw_json: Some(path),
    };
    let meta = Arc::new(RetainedPollMeta::new("bridge_fl_retained_sess"));
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
    let secret = Arc::<str>::from("bridge-fl-ret-secret");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (stream, _) = listener.accept().expect("accept");
        handle_ipc_dev_tcp_connection(stream, sec.as_ref(), rt.as_ref()).expect("handle");
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
                .uri("/sessions/bridge_fl_retained_sess/snapshot")
                .header("Authorization", "Bearer bridge-http-token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["events"].as_array().unwrap().len(), 1);
    assert_eq!(v["events"][0]["kind"], "file_poll_snapshot");
    assert!(v["retained_snapshot_unix_ms"].as_u64().is_some());
    assert_eq!(v["live_session_ingest"], false);
    assert_eq!(
        v["resync_hint"]["reason"],
        "retained_snapshot_tail_replaces_not_append_only"
    );
}

#[tokio::test]
async fn snapshot_retained_store_includes_retained_unix_ms() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("br_ret.json");
    let o = RawObservation::new(
        1,
        "bridge_retained_sess",
        11,
        RawObservationKind::ProcessSample,
        RawSourceQuality::ProcfsDerived,
        AdapterId::ProcfsProcess,
        serde_json::json!({
            "semantics": "procfs_poll_snapshot",
            "pid": 7,
            "comm": "br-ret",
            "ppid": 1,
        }),
    );
    std::fs::write(&path, serde_json::to_string(&vec![o]).unwrap()).unwrap();

    let store = Arc::new(SnapshotStore::new());
    let feed = ProcfsSnapshotFeedConfig {
        session_id: "bridge_retained_sess".to_string(),
        max_samples: 512,
        twice: false,
        from_raw_json: Some(path),
    };
    let meta = Arc::new(RetainedPollMeta::new("bridge_retained_sess"));
    retained_procfs_poll_tick(store.as_ref(), &feed, 256, Some(meta.as_ref())).unwrap();

    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let runtime = Arc::new(IpcDevTcpRuntime {
        store,
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: Some(meta),
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("bridge-retained-secret");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (stream, _) = listener.accept().expect("accept");
        handle_ipc_dev_tcp_connection(stream, sec.as_ref(), rt.as_ref()).expect("handle");
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
                .uri("/sessions/bridge_retained_sess/snapshot")
                .header("Authorization", "Bearer bridge-http-token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["events"].as_array().unwrap().len(), 1);
    assert!(v["retained_snapshot_unix_ms"].as_u64().is_some());
    assert_eq!(v["live_session_ingest"], false);
    assert_eq!(
        v["resync_hint"]["reason"],
        "retained_snapshot_tail_replaces_not_append_only"
    );
}

#[tokio::test]
async fn snapshot_truncation_emits_bounded_resync_hint() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let store = Arc::new(SnapshotStore::new());
    let evs: Vec<_> = (0..5)
        .map(|i| serde_json::json!({"kind": "demo", "seq": i}))
        .collect();
    store.set_session_events("ses_trunc", evs);
    let runtime = Arc::new(IpcDevTcpRuntime {
        store,
        procfs_feed: None,
        file_lane_feed: None,
        retained_poll_meta: None,
        file_lane_retained_poll_meta: None,
    });
    let secret = Arc::<str>::from("trunc-secret");
    let rt = runtime.clone();
    let sec = secret.clone();
    thread::spawn(move || {
        let (stream, _) = listener.accept().expect("accept");
        handle_ipc_dev_tcp_connection(stream, sec.as_ref(), rt.as_ref()).expect("handle");
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
                .uri("/sessions/ses_trunc/snapshot?max_events=2")
                .header("Authorization", "Bearer bridge-http-token")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let b = res.into_body().collect().await.unwrap().to_bytes();
    let v: serde_json::Value = serde_json::from_slice(&b).unwrap();
    assert_eq!(v["events"].as_array().unwrap().len(), 2);
    assert_eq!(v["snapshot_cursor"], "v0:off:2");
    assert_eq!(v["max_events_requested"], 2);
    assert_eq!(v["resync_hint"]["reason"], "bounded_truncation");
    assert_eq!(v["bounded_snapshot"]["truncated_by_max_events"], true);
    assert_eq!(v["bounded_snapshot"]["available_in_view"], 5);
    assert_eq!(v["bounded_snapshot"]["returned_events"], 2);
}

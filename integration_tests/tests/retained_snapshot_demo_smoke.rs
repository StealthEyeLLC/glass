//! Subprocess smoke: `glass-collector ipc-serve` (retained + fixture) + `glass_bridge` + authenticated snapshot GET.
//! Run via `cargo test -p integration_tests --test retained_snapshot_demo_smoke` (or full `cargo test --workspace`).

use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use std::time::{Duration, Instant};

static ENSURE_BUILT: OnceLock<()> = OnceLock::new();

fn ensure_bins() {
    ENSURE_BUILT.get_or_init(|| {
        let st = Command::new("cargo")
            .args(["build", "-q", "-p", "glass_collector", "-p", "glass_bridge"])
            .status()
            .expect("spawn cargo build");
        assert!(
            st.success(),
            "cargo build -p glass_collector -p glass_bridge failed"
        );
    });
}

fn workspace_target_debug() -> PathBuf {
    std::env::var_os("CARGO_TARGET_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../target"))
        .join("debug")
}

fn collector_exe() -> PathBuf {
    let d = workspace_target_debug();
    if cfg!(windows) {
        d.join("glass-collector.exe")
    } else {
        d.join("glass-collector")
    }
}

fn bridge_exe() -> PathBuf {
    let d = workspace_target_debug();
    if cfg!(windows) {
        d.join("glass_bridge.exe")
    } else {
        d.join("glass_bridge")
    }
}

fn pick_port() -> u16 {
    use std::net::TcpListener;
    TcpListener::bind("127.0.0.1:0")
        .unwrap()
        .local_addr()
        .unwrap()
        .port()
}

struct KillChild(Option<std::process::Child>);
impl Drop for KillChild {
    fn drop(&mut self) {
        if let Some(mut c) = self.0.take() {
            let _ = c.kill();
            let _ = c.wait();
        }
    }
}

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn demo_fixture() -> PathBuf {
    repo_root().join("scripts/retained_snapshot_demo/raw_observations_demo.json")
}

fn get_snapshot_json(bridge_port: u16, session: &str, token: &str) -> Option<serde_json::Value> {
    let url = format!("http://127.0.0.1:{bridge_port}/sessions/{session}/snapshot");
    let deadline = Instant::now() + Duration::from_secs(15);
    while Instant::now() < deadline {
        let req = ureq::get(&url).set("Authorization", &format!("Bearer {token}"));
        match req.call() {
            Ok(resp) => return resp.into_json().ok(),
            Err(_) => std::thread::sleep(Duration::from_millis(80)),
        }
    }
    None
}

#[test]
fn retained_snapshot_demo_smoke_collector_and_bridge() {
    ensure_bins();
    assert!(
        demo_fixture().is_file(),
        "missing {}; run from repo root",
        demo_fixture().display()
    );
    assert!(
        collector_exe().is_file(),
        "missing {}",
        collector_exe().display()
    );
    assert!(bridge_exe().is_file(), "missing {}", bridge_exe().display());

    let ipc_port = pick_port();
    let bridge_port = pick_port();
    let secret = "smoke-fipc-secret";
    let token = "smoke-http-token";
    let fix = demo_fixture();
    let fix_s = fix.to_str().expect("fixture path utf-8");

    let _collector = KillChild(Some(
        Command::new(collector_exe())
            .args([
                "ipc-serve",
                "--listen",
                &format!("127.0.0.1:{ipc_port}"),
                "--shared-secret",
                secret,
                "--procfs-retained-session",
                "demo_retained_sess",
                "--procfs-from-raw-json",
                fix_s,
                "--procfs-retained-interval-ms",
                "100",
                "--procfs-retained-max-events",
                "64",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn collector"),
    ));

    std::thread::sleep(Duration::from_millis(450));

    let _bridge = KillChild(Some(
        Command::new(bridge_exe())
            .args([
                "--listen",
                &format!("127.0.0.1:{bridge_port}"),
                "--token",
                token,
                "--collector-ipc-endpoint",
                &format!("127.0.0.1:{ipc_port}"),
                "--collector-ipc-secret",
                secret,
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn bridge"),
    ));

    std::thread::sleep(Duration::from_millis(200));

    let j = get_snapshot_json(bridge_port, "demo_retained_sess", token)
        .expect("snapshot GET should succeed within timeout");

    assert_eq!(j["session_id"], "demo_retained_sess");
    assert_eq!(j["live_session_ingest"], false);
    assert!(
        j["retained_snapshot_unix_ms"].is_number(),
        "expected retained_snapshot_unix_ms, got {:?}",
        j["retained_snapshot_unix_ms"]
    );
    let events = j["events"].as_array().expect("events array");
    assert!(
        !events.is_empty(),
        "expected non-empty events from fixture-backed retained poll"
    );
    assert!(events.len() <= 64, "bridge F-IPC client caps snapshot size");
    let cursor = j["snapshot_cursor"].as_str().expect("cursor str");
    assert!(cursor.starts_with("v0:"), "provisional cursor: {cursor}");
    assert_eq!(j["collector_ipc"]["status"], "ok");
}

#[test]
fn retained_snapshot_demo_smoke_empty_fixture_honest() {
    ensure_bins();
    assert!(collector_exe().is_file());
    assert!(bridge_exe().is_file());

    let dir =
        std::env::temp_dir().join(format!("glass_retained_empty_{}.json", std::process::id()));
    std::fs::write(&dir, "[]").unwrap();

    let ipc_port = pick_port();
    let bridge_port = pick_port();
    let secret = "smoke-empty-fipc";
    let token = "smoke-empty-http";
    let empty_s = dir.to_str().expect("path utf-8");

    let _collector = KillChild(Some(
        Command::new(collector_exe())
            .args([
                "ipc-serve",
                "--listen",
                &format!("127.0.0.1:{ipc_port}"),
                "--shared-secret",
                secret,
                "--procfs-retained-session",
                "demo_empty_sess",
                "--procfs-from-raw-json",
                empty_s,
                "--procfs-retained-interval-ms",
                "100",
                "--procfs-retained-max-events",
                "64",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn collector"),
    ));

    std::thread::sleep(Duration::from_millis(450));

    let _bridge = KillChild(Some(
        Command::new(bridge_exe())
            .args([
                "--listen",
                &format!("127.0.0.1:{bridge_port}"),
                "--token",
                token,
                "--collector-ipc-endpoint",
                &format!("127.0.0.1:{ipc_port}"),
                "--collector-ipc-secret",
                secret,
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn bridge"),
    ));

    std::thread::sleep(Duration::from_millis(200));

    let j = get_snapshot_json(bridge_port, "demo_empty_sess", token)
        .expect("snapshot GET should succeed");

    assert_eq!(j["session_id"], "demo_empty_sess");
    assert_eq!(j["live_session_ingest"], false);
    assert!(j["retained_snapshot_unix_ms"].is_number());
    let cur = j["snapshot_cursor"].as_str().unwrap();
    assert!(
        cur == "v0:empty" || cur == "v0:off:0",
        "empty retained store: expected v0:empty or v0:off:0, got {cur}"
    );
    assert_eq!(j["events"].as_array().unwrap().len(), 0);
}

#[test]
fn retained_snapshot_demo_smoke_retained_max_clamps_store_tail() {
    ensure_bins();
    let mut obs = Vec::new();
    for i in 1..=48u64 {
        obs.push(serde_json::json!({
            "observation_seq": i,
            "session_id": "clamp_demo_sess",
            "ts_monotonic_ns": i * 10,
            "kind": "process_sample",
            "quality": "procfs_derived",
            "source_adapter": "procfs_process",
            "payload": {
                "semantics": "procfs_poll_snapshot",
                "pid": i,
                "comm": "c",
                "ppid": 1
            }
        }));
    }
    let dir =
        std::env::temp_dir().join(format!("glass_retained_clamp_{}.json", std::process::id()));
    std::fs::write(&dir, serde_json::to_string(&obs).unwrap()).unwrap();
    let path_s = dir.to_str().unwrap();

    let ipc_port = pick_port();
    let bridge_port = pick_port();
    let secret = "smoke-clamp-fipc";
    let token = "smoke-clamp-http";

    let _collector = KillChild(Some(
        Command::new(collector_exe())
            .args([
                "ipc-serve",
                "--listen",
                &format!("127.0.0.1:{ipc_port}"),
                "--shared-secret",
                secret,
                "--procfs-retained-session",
                "clamp_demo_sess",
                "--procfs-from-raw-json",
                path_s,
                "--procfs-retained-interval-ms",
                "100",
                "--procfs-retained-max-events",
                "12",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn collector"),
    ));

    std::thread::sleep(Duration::from_millis(450));

    let _bridge = KillChild(Some(
        Command::new(bridge_exe())
            .args([
                "--listen",
                &format!("127.0.0.1:{bridge_port}"),
                "--token",
                token,
                "--collector-ipc-endpoint",
                &format!("127.0.0.1:{ipc_port}"),
                "--collector-ipc-secret",
                secret,
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn bridge"),
    ));

    std::thread::sleep(Duration::from_millis(200));

    let j = get_snapshot_json(bridge_port, "clamp_demo_sess", token).expect("snapshot ok");
    assert_eq!(j["live_session_ingest"], false);
    let n = j["events"].as_array().unwrap().len();
    assert_eq!(n, 12, "retained tail clamp: expected 12 events, got {n}");
    assert_eq!(j["snapshot_cursor"], "v0:off:12");
}

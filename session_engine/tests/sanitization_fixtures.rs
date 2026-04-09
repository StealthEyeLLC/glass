use std::fs;
use std::path::Path;

use session_engine::sanitization::{
    causality_fingerprint, sanitize_events_for_share, SanitizationProfile,
};
use session_engine::{EntityRef, NormalizedEventEnvelope};

fn load_case(name: &str) -> Vec<NormalizedEventEnvelope> {
    let p = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../tests/fixtures/sanitization")
        .join(format!("{name}.json"));
    let raw = fs::read_to_string(p).unwrap();
    serde_json::from_str(&raw).unwrap()
}

fn assert_no_leak(bytes: &[u8], needle: &str) {
    let s = String::from_utf8_lossy(bytes);
    assert!(
        !s.contains(needle),
        "leak of forbidden substring {needle:?} in output"
    );
}

#[test]
fn matrix_private_ip_redacted() {
    let evs = load_case("private_ip");
    let before = causality_fingerprint(&evs);
    let out = sanitize_events_for_share(
        &evs,
        SanitizationProfile {
            home_dir_prefix: None,
        },
    );
    assert_eq!(before, causality_fingerprint(&out.events));
    let serialized = serde_json::to_vec(&out.events).unwrap();
    assert_no_leak(&serialized, "192.168.");
    assert_no_leak(&serialized, "10.0.0.1");
}

#[test]
fn matrix_home_path_redacted() {
    let evs = load_case("home_path");
    let out = sanitize_events_for_share(
        &evs,
        SanitizationProfile {
            home_dir_prefix: Some("/home/testuser"),
        },
    );
    let s = serde_json::to_string(&out.events).unwrap();
    assert!(!s.contains("/home/testuser"));
    assert!(s.contains("[HOME]"));
}

#[test]
fn matrix_argv_redacted() {
    let evs = load_case("argv_secrets");
    let out = sanitize_events_for_share(
        &evs,
        SanitizationProfile {
            home_dir_prefix: None,
        },
    );
    let s = serde_json::to_string(&out.events).unwrap();
    assert!(!s.contains("SECRET_TOKEN"));
    assert!(s.contains("[ARG_REDACTED]"));
}

#[test]
fn matrix_internal_hostname_redacted() {
    let evs = load_case("internal_hostname");
    let out = sanitize_events_for_share(
        &evs,
        SanitizationProfile {
            home_dir_prefix: None,
        },
    );
    let s = serde_json::to_string(&out.events).unwrap();
    assert!(!s.contains("vault.corp"));
    assert!(s.contains("[REDACTED_HOST]") || s.contains("REDACTED_HOST"));
}

#[test]
fn matrix_socket_path_redacted() {
    let evs = load_case("sensitive_socket");
    let out = sanitize_events_for_share(
        &evs,
        SanitizationProfile {
            home_dir_prefix: None,
        },
    );
    let s = serde_json::to_string(&out.events).unwrap();
    assert!(!s.contains("/var/run/agent_auth.sock"));
}

#[test]
fn matrix_tilde_path_redacted() {
    let evs = load_case("tilde_path");
    let out = sanitize_events_for_share(
        &evs,
        SanitizationProfile {
            home_dir_prefix: None,
        },
    );
    let s = serde_json::to_string(&out.events).unwrap();
    assert!(!s.contains("~/"));
    assert!(s.contains("[HOME]/Documents"));
}

#[test]
fn matrix_causality_preserves_subject_edges() {
    let mut evs = load_case("causality_negative");
    evs[0].subject = Some(EntityRef {
        entity_type: "file".to_string(),
        entity_id: "file_edge".to_string(),
        resolution_quality: Some("direct".to_string()),
    });
    let before: Vec<_> = evs
        .iter()
        .map(|e| (e.seq, e.subject.as_ref().map(|s| s.entity_id.clone())))
        .collect();
    let out = sanitize_events_for_share(
        &evs,
        SanitizationProfile {
            home_dir_prefix: None,
        },
    );
    let after: Vec<_> = out
        .events
        .iter()
        .map(|e| (e.seq, e.subject.as_ref().map(|s| s.entity_id.clone())))
        .collect();
    assert_eq!(before, after);
}

#[test]
fn matrix_causality_preserved_public_paths() {
    let evs = load_case("causality_negative");
    let before = causality_fingerprint(&evs);
    let out = sanitize_events_for_share(
        &evs,
        SanitizationProfile {
            home_dir_prefix: None,
        },
    );
    assert_eq!(before, causality_fingerprint(&out.events));
    let s = serde_json::to_string(&out.events).unwrap();
    assert!(s.contains("/workspace/project/src/main.ts"));
}

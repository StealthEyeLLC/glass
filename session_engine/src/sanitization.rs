//! Pure share-safe sanitization: no I/O, no collector, no viewer.
//!
//! Profile `sanitize_default` is **provisional** until Phase 0 freeze (`docs/PHASE0_FREEZE_TRACKER.md`).
//!
//! **Socket path redaction (F-05):** heuristic on `.sock`, `/run/user/`, `/var/run/` — not exhaustive; see tracker.
//!
//! **File-lane path redaction (F-05, provisional):** directory-poll `relative_path`, `watch_root`, and the
//! `fs_poll_rel:` entity id suffix are replaced with fixed tokens on the **export lane only** — not a final policy;
//! see `docs/PHASE0_FREEZE_TRACKER.md` / `docs/SANITIZATION_TRUST_CRITERIA.md`.

use regex::Regex;
use serde_json::Value;

use crate::event::NormalizedEventEnvelope;
use crate::file_lane_normalize::FS_POLL_FILE_ENTITY_PREFIX;

/// Active sanitization profile version string (bump when rules change).
pub const SANITIZE_PROFILE_VERSION: &str = "sanitize_default.1.provisional";

#[derive(Debug, Clone, Copy)]
pub struct SanitizationProfile {
    /// Replace paths with this prefix (e.g. `/home/alice`) by `[HOME]`.
    pub home_dir_prefix: Option<&'static str>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SanitizationResult {
    pub events: Vec<NormalizedEventEnvelope>,
    pub human_readable_redaction_summary: Vec<String>,
    pub profile_version: String,
}

/// Sanitize a slice of events for share-safe export. Preserves `seq`, `ts_ns`, `event_id`, entity ids, and `kind`.
pub fn sanitize_events_for_share(
    events: &[NormalizedEventEnvelope],
    profile: SanitizationProfile,
) -> SanitizationResult {
    let mut out = Vec::with_capacity(events.len());
    let mut summary = Vec::new();

    let ipv4_priv = Regex::new(
        r"(?x)
        \b(?:
            127\.\d{1,3}\.\d{1,3}\.\d{1,3}
          | 10\.\d{1,3}\.\d{1,3}\.\d{1,3}
          | 192\.168\.\d{1,3}\.\d{1,3}
          | 172\.(?:1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}
        )\b",
    )
    .expect("static regex");

    let ipv6_local = Regex::new(r"(?i)\b(?:fe80:[0-9a-f:]+|::1)\b").expect("static regex");

    let internal_host =
        Regex::new(r"(?i)([a-z0-9.-]+\.(?:local|internal|corp)\b)").expect("static regex");

    for e in events {
        let mut e2 = e.clone();
        redact_value_strings(
            &mut e2.attrs,
            &ipv4_priv,
            &ipv6_local,
            &internal_host,
            profile.home_dir_prefix,
        );
        redact_value_strings(
            &mut e2.source,
            &ipv4_priv,
            &ipv6_local,
            &internal_host,
            profile.home_dir_prefix,
        );
        redact_argv(&mut e2.attrs);
        redact_socket_paths(&mut e2.attrs);
        redact_procfs_exe_in_attrs(&mut e2.attrs);
        redact_file_lane_path_attrs_provisional(&mut e2);
        out.push(e2);
    }

    summary.push("rule:private_ipv4_literal -> [REDACTED_IPV4]".to_string());
    summary.push("rule:ipv6_link_local_or_loopback -> [REDACTED_IPV6]".to_string());
    summary.push("rule:internal_hostname_suffix -> [REDACTED_HOST]".to_string());
    summary.push("rule:tilde_path -> [HOME]/...".to_string());
    if profile.home_dir_prefix.is_some() {
        summary.push("rule:home_dir_prefix -> [HOME]".to_string());
    }
    summary.push("rule:argv_tail -> [ARG_REDACTED]".to_string());
    summary.push("rule:sensitive_socket_path -> [REDACTED_SOCK]".to_string());
    summary.push("rule:procfs_exe_field -> [REDACTED_ABS_PATH]".to_string());
    summary.push(
        "rule:file_lane_relative_path_provisional (F-05 open) -> [REDACTED_REL_PATH]".to_string(),
    );
    summary.push(
        "rule:file_lane_watch_root_provisional (F-05 open) -> [REDACTED_ABS_PATH]".to_string(),
    );
    summary.push(
        "rule:file_lane_entity_id_suffix_provisional (F-05 open) -> fs_poll_rel:[REDACTED]"
            .to_string(),
    );

    SanitizationResult {
        events: out,
        human_readable_redaction_summary: summary,
        profile_version: SANITIZE_PROFILE_VERSION.to_string(),
    }
}

fn redact_argv(attrs: &mut Value) {
    let Some(obj) = attrs.as_object_mut() else {
        return;
    };
    let Some(argv) = obj.get_mut("argv") else {
        return;
    };
    let Some(arr) = argv.as_array_mut() else {
        return;
    };
    for (i, v) in arr.iter_mut().enumerate() {
        if i == 0 {
            continue;
        }
        *v = Value::String("[ARG_REDACTED]".to_string());
    }
}

/// `attrs.exe` from procfs-style events carries full filesystem paths — export lane redacts to a single token (not a path-preserving transform).
fn redact_procfs_exe_in_attrs(attrs: &mut Value) {
    let Some(obj) = attrs.as_object_mut() else {
        return;
    };
    if let Some(Value::String(s)) = obj.get("exe") {
        if !s.is_empty() && !s.starts_with('[') {
            obj.insert(
                "exe".to_string(),
                Value::String("[REDACTED_ABS_PATH]".to_string()),
            );
        }
    }
}

const FILE_LANE_KINDS: &[&str] = &[
    "file_poll_snapshot",
    "file_changed_between_polls",
    "file_absent_in_poll_gap",
    "file_seen_in_poll_gap",
];

fn file_lane_event_needs_path_redaction(e: &NormalizedEventEnvelope) -> bool {
    FILE_LANE_KINDS.iter().any(|k| k == &e.kind)
        || e.actor.entity_id.starts_with(FS_POLL_FILE_ENTITY_PREFIX)
}

/// Narrow, **provisional** export-lane redaction for directory-poll file lane path-bearing fields (F-05 not frozen).
fn redact_file_lane_path_attrs_provisional(e: &mut NormalizedEventEnvelope) {
    if !file_lane_event_needs_path_redaction(e) {
        return;
    }
    if e.actor.entity_id.starts_with(FS_POLL_FILE_ENTITY_PREFIX) {
        e.actor.entity_id = format!("{FS_POLL_FILE_ENTITY_PREFIX}[REDACTED]");
    }
    let Some(obj) = e.attrs.as_object_mut() else {
        return;
    };
    if let Some(Value::String(s)) = obj.get("relative_path") {
        if !s.is_empty() && !s.starts_with('[') {
            obj.insert(
                "relative_path".to_string(),
                Value::String("[REDACTED_REL_PATH]".to_string()),
            );
        }
    }
    if let Some(Value::String(s)) = obj.get("watch_root") {
        if !s.is_empty() && !s.starts_with('[') {
            obj.insert(
                "watch_root".to_string(),
                Value::String("[REDACTED_ABS_PATH]".to_string()),
            );
        }
    }
}

fn redact_socket_paths(attrs: &mut Value) {
    let Some(obj) = attrs.as_object_mut() else {
        return;
    };
    for key in ["socket_path", "path", "ipc_path"] {
        let Some(v) = obj.get_mut(key) else {
            continue;
        };
        if let Some(s) = v.as_str() {
            if s.contains(".sock") || s.contains("/run/user/") || s.contains("/var/run/") {
                *v = Value::String("[REDACTED_SOCK]".to_string());
            }
        }
    }
}

fn redact_value_strings(
    v: &mut Value,
    ipv4: &Regex,
    ipv6: &Regex,
    host: &Regex,
    home: Option<&str>,
) {
    match v {
        Value::String(s) => {
            let mut t = s.clone();
            t = ipv4.replace_all(&t, "[REDACTED_IPV4]").to_string();
            t = ipv6.replace_all(&t, "[REDACTED_IPV6]").to_string();
            t = host.replace_all(&t, "[REDACTED_HOST]").to_string();
            if t.starts_with("~/") {
                t = format!("[HOME]/{}", &t[2..]);
            } else if t == "~" {
                t = "[HOME]".to_string();
            }
            if let Some(h) = home {
                if t.starts_with(h) {
                    t = format!("[HOME]{}", &t[h.len()..]);
                }
            }
            *s = t;
        }
        Value::Array(a) => {
            for x in a {
                redact_value_strings(x, ipv4, ipv6, host, home);
            }
        }
        Value::Object(o) => {
            for (_k, x) in o.iter_mut() {
                redact_value_strings(x, ipv4, ipv6, host, home);
            }
        }
        _ => {}
    }
}

/// After sanitization, structural causality: seq order and ids unchanged (for tests).
pub fn causality_fingerprint(
    events: &[NormalizedEventEnvelope],
) -> Vec<(u64, String, String, String)> {
    events
        .iter()
        .map(|e| {
            (
                e.seq,
                e.event_id.clone(),
                e.actor.entity_id.clone(),
                e.kind.clone(),
            )
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::event::NormalizedEventEnvelope;

    #[test]
    fn preserves_seq_and_ids_redacts_ip() {
        let mut e = NormalizedEventEnvelope::minimal_stub(1, "ses1", "network_connect_attempt");
        e.attrs = serde_json::json!({
            "endpoint": "192.168.1.10:443",
            "path": "/tmp/secret.sock"
        });
        let before = causality_fingerprint(std::slice::from_ref(&e));
        let r = sanitize_events_for_share(
            &[e],
            SanitizationProfile {
                home_dir_prefix: None,
            },
        );
        let after = causality_fingerprint(&r.events);
        assert_eq!(before, after);
        let s = r.events[0].attrs["endpoint"].as_str().unwrap();
        assert!(!s.contains("192.168"));
        assert!(s.contains("REDACTED") || s.contains("[REDACTED_IPV4]"));
    }

    #[test]
    fn redacts_procfs_exe_field() {
        let mut e = NormalizedEventEnvelope::minimal_stub(1, "ses", "process_poll_sample");
        e.attrs = serde_json::json!({
            "exe": "/home/alice/.local/bin/myapp",
            "comm": "myapp",
            "pid": 1
        });
        let before = causality_fingerprint(std::slice::from_ref(&e));
        let r = sanitize_events_for_share(
            &[e],
            SanitizationProfile {
                home_dir_prefix: None,
            },
        );
        assert_eq!(before, causality_fingerprint(&r.events));
        assert_eq!(
            r.events[0].attrs["exe"].as_str().unwrap(),
            "[REDACTED_ABS_PATH]"
        );
        assert!(r
            .human_readable_redaction_summary
            .iter()
            .any(|l| l.contains("procfs_exe")));
    }

    #[test]
    fn redacts_file_lane_path_fields_provisional() {
        let mut e = NormalizedEventEnvelope::minimal_stub(1, "ses", "file_poll_snapshot");
        e.actor.entity_id = "fs_poll_rel:secret/nested/file.txt".to_string();
        e.actor.entity_type = "file".to_string();
        e.attrs = serde_json::json!({
            "relative_path": "secret/nested/file.txt",
            "watch_root": "/home/alice/projects",
            "semantics": "bounded_directory_poll_snapshot",
            "not_syscall_file_access": true,
        });
        let before = causality_fingerprint(std::slice::from_ref(&e));
        let r = sanitize_events_for_share(
            &[e],
            SanitizationProfile {
                home_dir_prefix: None,
            },
        );
        assert_ne!(before, causality_fingerprint(&r.events));
        assert_eq!(r.events[0].actor.entity_id, "fs_poll_rel:[REDACTED]");
        assert_eq!(
            r.events[0].attrs["relative_path"].as_str().unwrap(),
            "[REDACTED_REL_PATH]"
        );
        assert_eq!(
            r.events[0].attrs["watch_root"].as_str().unwrap(),
            "[REDACTED_ABS_PATH]"
        );
        assert!(r
            .human_readable_redaction_summary
            .iter()
            .any(|l| l.contains("file_lane_relative_path")));
    }
}

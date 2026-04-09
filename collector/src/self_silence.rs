//! Self-observation suppression — exclude Glass-owned processes **before** normalization input.
//!
//! **Honesty:** namespace/cgroup/container edge cases are **not** fully specified; this is lineage + PID/binary hint matching only.

use serde::{Deserialize, Serialize};

use crate::raw::RawObservation;

/// Logical Glass component (for lineage matching).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum GlassComponent {
    Collector,
    Bridge,
    ViewerHelper,
    PackTool,
    UnknownTestDouble,
}

/// Identity used to match `RawObservation` payloads (e.g. `pid`, `comm`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LineageIdentity {
    pub component: GlassComponent,
    pub pid: Option<u32>,
    pub binary_basename_hint: Option<String>,
}

impl LineageIdentity {
    pub fn collector_self(pid: Option<u32>) -> Self {
        Self {
            component: GlassComponent::Collector,
            pid,
            binary_basename_hint: Some("glass-collector".to_string()),
        }
    }
}

/// Policy: which lineages to drop on the hot path.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct SelfSilencePolicy {
    pub entries: Vec<LineageIdentity>,
}

impl SelfSilencePolicy {
    pub fn with_collector_pid(pid: u32) -> Self {
        Self {
            entries: vec![LineageIdentity::collector_self(Some(pid))],
        }
    }
}

/// Counters for audit/diagnostics (bridge can surface later).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct SelfSilenceCounters {
    pub raw_observations_examined: u64,
    pub suppressed_before_normalize: u64,
}

/// Returns true if this raw observation must not reach normalization.
pub fn should_suppress_raw(obs: &RawObservation, policy: &SelfSilencePolicy) -> bool {
    let pid = obs
        .payload
        .get("pid")
        .and_then(|v| v.as_u64())
        .map(|n| n as u32);
    let comm = obs
        .payload
        .get("comm")
        .and_then(|v| v.as_str())
        .map(str::to_string);

    for entry in &policy.entries {
        if let Some(p) = entry.pid {
            if Some(p) == pid {
                return true;
            }
        }
        if let Some(ref hint) = entry.binary_basename_hint {
            if comm.as_ref().is_some_and(|c| c.eq_ignore_ascii_case(hint)) {
                return true;
            }
        }
    }
    false
}

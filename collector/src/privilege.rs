//! Privilege context for the **privileged collector** vs **unprivileged bridge** split (see `docs/PRIVILEGE_SEPARATION.md`).

use serde::{Deserialize, Serialize};

/// Effective privilege for sensor attach (CAP_BPF, root, etc.). **Detected for real in a later revision** — today config-driven / default.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PrivilegeMode {
    Privileged,
    Unprivileged,
}

/// Which side of the split this binary instance runs as (future: two processes).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CollectorProcessRole {
    /// May load eBPF / access restricted procfs.
    PrivilegedSensor,
    /// Talks to bridge over local IPC; **must not** hold sensor capabilities.
    BridgeFacingRelay,
}

/// Runtime privilege + coarse capability string for fidelity reporting.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PrivilegeContext {
    pub mode: PrivilegeMode,
    pub role: CollectorProcessRole,
    /// e.g. `"unknown_until_runtime_probe"` until real detection exists.
    pub effective_capability_summary: String,
}

impl Default for PrivilegeContext {
    fn default() -> Self {
        Self {
            mode: PrivilegeMode::Unprivileged,
            role: CollectorProcessRole::PrivilegedSensor,
            effective_capability_summary: "not_probed; Phase 2 skeleton".to_string(),
        }
    }
}

impl PrivilegeContext {
    pub fn for_fidelity(privilege_mode: PrivilegeMode) -> Self {
        Self {
            mode: privilege_mode,
            role: CollectorProcessRole::PrivilegedSensor,
            effective_capability_summary: if privilege_mode == PrivilegeMode::Privileged {
                "assumed_privileged_not_verified".to_string()
            } else {
                "unprivileged_no_ebpf_attach".to_string()
            },
        }
    }
}

//! Adapter capability and fidelity reporting — **honest** declarations for viewer/manifest/bridge later.

use serde::{Deserialize, Serialize};

use crate::privilege::PrivilegeMode;

/// Stable adapter identifiers (config + manifests).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AdapterId {
    LinuxEbpf,
    ProcfsProcess,
    FsFileLane,
    NetworkLane,
}

impl AdapterId {
    pub const fn as_str(self) -> &'static str {
        match self {
            AdapterId::LinuxEbpf => "linux_ebpf",
            AdapterId::ProcfsProcess => "procfs_process",
            AdapterId::FsFileLane => "fs_file_lane",
            AdapterId::NetworkLane => "network_lane",
        }
    }
}

/// Observation lane for grouping capabilities.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ObservationLane {
    KernelEbpf,
    ProcessUser,
    FileSystem,
    Network,
}

/// Per-adapter honest capability surface.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AdapterCapabilityManifest {
    pub adapter_id: AdapterId,
    pub lane: ObservationLane,
    /// True if this adapter **would** require privileged attach (eBPF, some netlink).
    pub requires_privilege_for_full_fidelity: bool,
    /// True once the adapter actually produces observations in this build (e.g. procfs on Linux).
    pub implementation_active: bool,
    /// Human-readable: what this build **can** do today.
    pub supports_today: Vec<String>,
    /// Human-readable: explicitly **not** implemented / not claimed.
    pub does_not_support_yet: Vec<String>,
}

/// Overall collector fidelity vs spec ambition.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FidelityMode {
    /// Primary path: eBPF + full lanes (not active in this repo revision).
    HighFidelityPrimary,
    /// Reduced visibility: procfs/limited lanes only — **honest default label for skeleton**.
    FallbackReducedVisibility,
    /// No sensor produced observations (startup failure or all adapters idle).
    NoSensorsActive,
}

/// Report suitable for IPC toward bridge and later `fidelity_tier` / operator UI.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct FidelityReport {
    pub mode: FidelityMode,
    pub privilege_mode: PrivilegeMode,
    pub summary_for_operator: String,
    pub adapters: Vec<AdapterCapabilityManifest>,
    /// Event classes from the spec/product plan that are **not** observable in this mode.
    pub missing_event_classes: Vec<String>,
}

pub(crate) fn compute_missing_event_classes(
    manifests: &[AdapterCapabilityManifest],
    mode: FidelityMode,
) -> Vec<String> {
    let mut missing = Vec::new();
    if mode != FidelityMode::HighFidelityPrimary {
        missing.push("kernel_ebpf_syscalls".to_string());
        missing.push("fine_grained_file_access".to_string());
        missing.push("socket_level_network_correlation".to_string());
        missing.push("atomic_kernel_process_spawn_exit_truth".to_string());
    }
    let ebpf = manifests
        .iter()
        .find(|m| m.adapter_id == AdapterId::LinuxEbpf);
    if let Some(m) = ebpf {
        if !m.implementation_active {
            missing.push("linux_ebpf_programs_attached".to_string());
        }
    }
    missing.sort();
    missing.dedup();
    missing
}

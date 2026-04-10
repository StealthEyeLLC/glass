//! Collector adapters — **capability-first** skeletons. No fake eBPF completion.

mod fs_file_lane;
mod linux_ebpf;
mod network_lane;
mod procfs_process;

pub use fs_file_lane::FsFileLaneAdapter;
pub use linux_ebpf::LinuxEbpfAdapter;
pub use network_lane::NetworkLaneAdapter;
pub use procfs_process::ProcfsProcessAdapter;

use thiserror::Error;

use crate::capability::{
    compute_missing_event_classes, AdapterCapabilityManifest, AdapterId, FidelityMode,
    FidelityReport,
};
use crate::privilege::PrivilegeMode;
use crate::raw::RawObservation;

#[derive(Debug, Error)]
pub enum AdapterError {
    #[error("adapter not implemented: {0}")]
    Unsupported(&'static str),
    #[error("IO: {0}")]
    Io(#[from] std::io::Error),
}

pub trait CollectorAdapter: Send {
    fn adapter_id(&self) -> AdapterId;
    fn capability_manifest(&self) -> AdapterCapabilityManifest;
    /// Poll raw observations. Skeleton returns `Unsupported` or empty per adapter honesty.
    fn poll_raw(&mut self) -> Result<Vec<RawObservation>, AdapterError>;
}

pub fn build_fidelity_report(
    privilege_mode: PrivilegeMode,
    adapters: &[Box<dyn CollectorAdapter>],
) -> FidelityReport {
    let manifests: Vec<AdapterCapabilityManifest> =
        adapters.iter().map(|a| a.capability_manifest()).collect();

    let any_active = manifests.iter().any(|m| m.implementation_active);
    let mode = if any_active {
        if privilege_mode == PrivilegeMode::Privileged
            && manifests
                .iter()
                .any(|m| m.adapter_id == AdapterId::LinuxEbpf && m.implementation_active)
        {
            FidelityMode::HighFidelityPrimary
        } else {
            FidelityMode::FallbackReducedVisibility
        }
    } else {
        FidelityMode::NoSensorsActive
    };

    let procfs_live = manifests
        .iter()
        .any(|m| m.adapter_id == AdapterId::ProcfsProcess && m.implementation_active);

    let fs_lane_live = manifests
        .iter()
        .any(|m| m.adapter_id == AdapterId::FsFileLane && m.implementation_active);

    let mut summary_for_operator = match mode {
        FidelityMode::HighFidelityPrimary => {
            "Full primary sensors active (eBPF-class path reported active).".to_string()
        }
        FidelityMode::FallbackReducedVisibility => {
            "Fallback mode — reduced visibility. eBPF-class path not active; only declared partial lanes may emit observations.".to_string()
        }
        FidelityMode::NoSensorsActive => {
            "No sensors active — collector skeleton; no observations emitted.".to_string()
        }
    };

    if mode == FidelityMode::FallbackReducedVisibility && procfs_live && fs_lane_live {
        summary_for_operator = "Fallback mode — reduced visibility. procfs_process emits bounded /proc snapshot + poll-gap deltas (not kernel spawn/exit truth). fs_file_lane emits bounded directory poll snapshots + poll-gap file deltas under a declared root (not syscall-level file I/O truth). eBPF, fanotify-class access, and socket-level correlation remain unavailable.".to_string();
    } else if mode == FidelityMode::FallbackReducedVisibility && fs_lane_live && !procfs_live {
        summary_for_operator = "Fallback mode — reduced visibility. fs_file_lane emits bounded directory poll snapshots + poll-gap file deltas under a declared root (not syscall-level file I/O truth). procfs lane inactive; eBPF and fanotify-class access remain unavailable.".to_string();
    } else if mode == FidelityMode::FallbackReducedVisibility && procfs_live {
        summary_for_operator = "Fallback mode — reduced visibility. procfs_process emits bounded /proc snapshot + poll-gap deltas (not kernel spawn/exit truth). eBPF, fine-grained file access, and socket-level correlation remain unavailable.".to_string();
    }

    let missing_event_classes = compute_missing_event_classes(&manifests, mode);

    FidelityReport {
        mode,
        privilege_mode,
        summary_for_operator,
        adapters: manifests,
        missing_event_classes,
    }
}

pub fn default_adapter_stack() -> Vec<Box<dyn CollectorAdapter>> {
    vec![
        Box::new(LinuxEbpfAdapter),
        Box::new(ProcfsProcessAdapter::default()),
        Box::new(FsFileLaneAdapter::default()),
        Box::new(NetworkLaneAdapter),
    ]
}

/// Shared stub quality for unimplemented polls.
pub(crate) fn not_implemented_poll() -> Result<Vec<RawObservation>, AdapterError> {
    Ok(vec![])
}

pub(crate) fn ebpf_unsupported_poll() -> Result<Vec<RawObservation>, AdapterError> {
    Err(AdapterError::Unsupported(
        "linux_ebpf: program attach and ring buffer not implemented",
    ))
}

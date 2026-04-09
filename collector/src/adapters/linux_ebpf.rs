use crate::adapters::{AdapterError, CollectorAdapter};
use crate::capability::{AdapterCapabilityManifest, AdapterId, ObservationLane};

#[derive(Debug, Clone, Copy)]
pub struct LinuxEbpfAdapter;

impl CollectorAdapter for LinuxEbpfAdapter {
    fn adapter_id(&self) -> AdapterId {
        AdapterId::LinuxEbpf
    }

    fn capability_manifest(&self) -> AdapterCapabilityManifest {
        AdapterCapabilityManifest {
            adapter_id: AdapterId::LinuxEbpf,
            lane: ObservationLane::KernelEbpf,
            requires_privilege_for_full_fidelity: true,
            implementation_active: false,
            supports_today: vec!["capability_declaration_only".to_string()],
            does_not_support_yet: vec![
                "bpf_prog_load".to_string(),
                "ring_buffer_read".to_string(),
                "kprobe_attach".to_string(),
            ],
        }
    }

    fn poll_raw(&mut self) -> Result<Vec<crate::raw::RawObservation>, AdapterError> {
        super::ebpf_unsupported_poll()
    }
}

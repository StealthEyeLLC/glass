use crate::adapters::{AdapterError, CollectorAdapter};
use crate::capability::{AdapterCapabilityManifest, AdapterId, ObservationLane};

#[derive(Debug, Clone, Copy)]
pub struct NetworkLaneAdapter;

impl CollectorAdapter for NetworkLaneAdapter {
    fn adapter_id(&self) -> AdapterId {
        AdapterId::NetworkLane
    }

    fn capability_manifest(&self) -> AdapterCapabilityManifest {
        AdapterCapabilityManifest {
            adapter_id: AdapterId::NetworkLane,
            lane: ObservationLane::Network,
            requires_privilege_for_full_fidelity: true,
            implementation_active: false,
            supports_today: vec!["capability_declaration_only".to_string()],
            does_not_support_yet: vec![
                "netlink_diag".to_string(),
                "socket_inode_correlation".to_string(),
            ],
        }
    }

    fn poll_raw(&mut self) -> Result<Vec<crate::raw::RawObservation>, AdapterError> {
        super::not_implemented_poll()
    }
}

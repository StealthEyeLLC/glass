use crate::adapters::{AdapterError, CollectorAdapter};
use crate::capability::{AdapterCapabilityManifest, AdapterId, ObservationLane};

#[derive(Debug, Clone, Copy)]
pub struct FsFileLaneAdapter;

impl CollectorAdapter for FsFileLaneAdapter {
    fn adapter_id(&self) -> AdapterId {
        AdapterId::FsFileLane
    }

    fn capability_manifest(&self) -> AdapterCapabilityManifest {
        AdapterCapabilityManifest {
            adapter_id: AdapterId::FsFileLane,
            lane: ObservationLane::FileSystem,
            requires_privilege_for_full_fidelity: false,
            implementation_active: false,
            supports_today: vec!["capability_declaration_only".to_string()],
            does_not_support_yet: vec!["fanotify_open".to_string(), "inotify_user".to_string()],
        }
    }

    fn poll_raw(&mut self) -> Result<Vec<crate::raw::RawObservation>, AdapterError> {
        super::not_implemented_poll()
    }
}

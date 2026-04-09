//! Collector configuration surface (Phase 2 — **minimal** defaults).

use serde::{Deserialize, Serialize};

use crate::capability::AdapterId;
use crate::privilege::PrivilegeMode;
use crate::self_silence::SelfSilencePolicy;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CollectorConfig {
    pub privilege_mode: PrivilegeMode,
    pub enabled_adapters: Vec<AdapterId>,
    pub self_silence: SelfSilencePolicy,
}

impl Default for CollectorConfig {
    fn default() -> Self {
        Self {
            privilege_mode: PrivilegeMode::Unprivileged,
            enabled_adapters: vec![
                AdapterId::LinuxEbpf,
                AdapterId::ProcfsProcess,
                AdapterId::FsFileLane,
                AdapterId::NetworkLane,
            ],
            self_silence: SelfSilencePolicy::default(),
        }
    }
}

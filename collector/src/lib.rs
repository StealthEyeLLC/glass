//! Glass Linux collector — **Phase 2 groundwork**.
//!
//! ## Boundaries (honest)
//! - **[`raw`]** — host observations **before** normalization. Not `NormalizedEventEnvelope`.
//! - **`session_engine`** — canonical normalized + export/sanitization; **procfs** DTO → envelope in `session_engine::procfs_normalize` (collector calls via `procfs_session`).
//! - **Adapters** — capability-first; **no** claim of complete eBPF/procfs capture until implemented.
//! - **[`ipc`]** — skeleton for **authenticated local IPC** toward the unprivileged bridge (no live socket server here).
//! - **[`self_silence`]** — suppress Glass-owned processes **before** any normalization input.
//!
//! See `docs/PRIVILEGE_SEPARATION.md`, `docs/REPO_BOUNDARIES.md`.

pub mod adapters;
pub mod capability;
pub mod config;
pub mod ipc;
pub mod pipeline;
pub mod privilege;
pub mod procfs_session;
pub mod procfs_snapshot;
pub mod raw;
pub mod self_silence;

pub use adapters::{
    build_fidelity_report, default_adapter_stack, AdapterError, CollectorAdapter,
    ProcfsProcessAdapter,
};
pub use capability::{
    AdapterCapabilityManifest, AdapterId, FidelityMode, FidelityReport, ObservationLane,
};
pub use config::CollectorConfig;
pub use ipc::{
    validate_ipc_auth_version, CollectorIpcError, CollectorIpcMessage, IpcAuthHandshake,
    IpcMessageKind, IpcPayload, PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
};
pub use pipeline::{filter_for_normalization_input, PipelineStats};
pub use privilege::{CollectorProcessRole, PrivilegeContext, PrivilegeMode};
pub use raw::{RawObservation, RawObservationKind, RawSourceQuality};
pub use self_silence::{GlassComponent, LineageIdentity, SelfSilenceCounters, SelfSilencePolicy};

pub use procfs_session::{
    ingest_procfs_raw_to_session_log, procfs_dtos_from_raw, raw_to_procfs_dto,
};

/// Build the default fidelity report for the current adapter stack (on Linux, procfs lane is **active** when enabled).
pub fn default_fidelity_report() -> FidelityReport {
    let adapters = default_adapter_stack();
    build_fidelity_report(PrivilegeMode::Unprivileged, &adapters)
}

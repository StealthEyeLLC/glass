//! Glass Linux collector — **Phase 2 groundwork**.
//!
//! ## Boundaries (honest)
//! - **[`raw`]** — host observations **before** normalization. Not `NormalizedEventEnvelope`.
//! - **`session_engine`** — canonical normalized + export/sanitization; **procfs** DTO → envelope in `session_engine::procfs_normalize` (collector calls via `procfs_session`).
//! - **Adapters** — capability-first; **no** claim of complete eBPF/procfs capture until implemented.
//! - **[`ipc`] / [`ipc_dev_tcp`]** — versioned F-IPC messages; **provisional** dev TCP server (not final transport).
//! - **[`procfs_ipc_feed`]** — procfs or fixture `RawObservation[]` → normalize → JSON for bounded F-IPC snapshots (`ipc-serve --procfs-session`).
//! - **[`file_lane_ipc_feed`]** — file-lane poll or fixture → normalize → JSON for bounded F-IPC snapshots (`ipc-serve --file-lane-session`).
//! - **[`procfs_retained_loop`]** — optional background procfs poll → bounded retained [`SnapshotStore`] (`ipc-serve --procfs-retained-session`); **not** live deltas.
//! - **[`file_lane_retained_loop`]** — optional background file-lane poll → bounded retained store (`ipc-serve --file-lane-retained-session`); **not** live deltas.
//! - **[`self_silence`]** — suppress Glass-owned processes **before** any normalization input.
//!
//! See `docs/PRIVILEGE_SEPARATION.md`, `docs/REPO_BOUNDARIES.md`.

pub mod adapters;
pub mod capability;
pub mod config;
pub mod file_lane_ipc_feed;
pub mod file_lane_retained_loop;
pub mod file_session;
pub mod ipc;
pub mod ipc_dev_tcp;
pub mod pipeline;
pub mod privilege;
pub mod procfs_ipc_feed;
pub mod procfs_retained_loop;
pub mod procfs_session;
pub mod procfs_snapshot;
pub mod raw;
pub mod self_silence;

pub use adapters::{
    build_fidelity_report, default_adapter_stack, AdapterError, CollectorAdapter,
    FsFileLaneAdapter, ProcfsProcessAdapter,
};
pub use capability::{
    AdapterCapabilityManifest, AdapterId, FidelityMode, FidelityReport, ObservationLane,
};
pub use config::CollectorConfig;
pub use file_lane_ipc_feed::FileLaneSnapshotFeedConfig;
pub use file_lane_retained_loop::{
    retained_file_lane_poll_tick, spawn_retained_file_lane_loop, RetainedFileLaneLoopConfig,
};
pub use ipc::{
    validate_ipc_auth_version, CollectorIpcError, CollectorIpcMessage, FipcBoundedSnapshotMeta,
    FipcBridgeToCollector, FipcCollectorToBridge, IpcAuthHandshake, IpcMessageKind, IpcPayload,
    FIPC_SNAPSHOT_ORIGIN_COLLECTOR_STORE, FIPC_SNAPSHOT_ORIGIN_PER_RPC_FILE_LANE,
    FIPC_SNAPSHOT_ORIGIN_PER_RPC_PROCFS, FIPC_SNAPSHOT_ORIGIN_UNKNOWN_OR_EMPTY,
    PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS, PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
    PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
};
pub use ipc_dev_tcp::{
    handle_ipc_dev_tcp_connection, run_ipc_dev_tcp_listener, unix_epoch_millis_now,
    IpcDevTcpListenConfig, IpcDevTcpRuntime, RetainedPollMeta, SnapshotStore,
};
pub use pipeline::{filter_for_normalization_input, PipelineStats};
pub use privilege::{CollectorProcessRole, PrivilegeContext, PrivilegeMode};
pub use procfs_ipc_feed::{load_procfs_observations_for_cli, ProcfsSnapshotFeedConfig};
pub use procfs_retained_loop::{
    retained_procfs_poll_tick, spawn_retained_procfs_loop, RetainedProcfsLoopConfig,
    PROVISIONAL_MAX_RETAINED_SNAPSHOT_EVENTS,
};
pub use raw::{RawObservation, RawObservationKind, RawSourceQuality};
pub use self_silence::{GlassComponent, LineageIdentity, SelfSilenceCounters, SelfSilencePolicy};

pub use file_session::{
    file_lane_dtos_from_raw, ingest_file_lane_raw_to_session_log,
    load_file_lane_observations_for_cli, raw_to_file_lane_dto,
};
pub use procfs_session::{
    ingest_procfs_raw_to_session_log, procfs_dtos_from_raw, raw_to_procfs_dto,
};

/// Build the default fidelity report for the current adapter stack (on Linux, procfs lane is **active** when enabled).
pub fn default_fidelity_report() -> FidelityReport {
    let adapters = default_adapter_stack();
    build_fidelity_report(PrivilegeMode::Unprivileged, &adapters)
}

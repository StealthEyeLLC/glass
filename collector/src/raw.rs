//! Raw host observations — **not** normalized envelopes and **not** share-safe export events.
//!
//! Normalization into `session_engine::NormalizedEventEnvelope` is implemented for **procfs** rows via [`crate::procfs_session`] and `session_engine::procfs_normalize`. Export sanitization runs only on the export path per build plan.

use serde::{Deserialize, Serialize};

use crate::capability::AdapterId;

/// How the adapter obtained this observation (honest quality hint).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RawSourceQuality {
    /// Direct kernel/eBPF path (not claimed until implemented).
    KernelDirect,
    /// /proc, getpid, etc.
    ProcfsDerived,
    /// fanotify/inotify-style (not claimed until implemented).
    FsNotifyDerived,
    /// netlink / proc net (not claimed until implemented).
    NetDerived,
    /// Placeholder / unknown.
    Unspecified,
}

/// Coarse raw observation class (adapter-specific payloads in [`RawObservation::payload`]).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RawObservationKind {
    ProcessLifecycle,
    ProcessSpawn,
    /// One row from a `/proc` poll snapshot — **not** a kernel `process_start` event.
    ProcessSample,
    /// PID appeared since previous poll — **polling-derived**; not exact spawn time.
    ProcessSeenInPollGap,
    /// PID missing vs previous poll — **polling-derived**; not exact exit time.
    ProcessAbsentInPollGap,
    FilePathAccess,
    NetworkSocket,
    IpcEndpoint,
    /// Catch-all for forward-compatible probes.
    Other(String),
}

/// One raw observation from a sensor **before** identity normalization and before share-safe redaction.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct RawObservation {
    /// Monotonic counter within the collector run (not global event seq).
    pub observation_seq: u64,
    pub session_id: String,
    pub ts_monotonic_ns: u64,
    pub kind: RawObservationKind,
    pub quality: RawSourceQuality,
    pub source_adapter: AdapterId,
    /// Adapter-specific structured fields (PIDs, paths, fds — may contain secrets).
    pub payload: serde_json::Value,
}

impl RawObservation {
    pub fn new(
        observation_seq: u64,
        session_id: impl Into<String>,
        ts_monotonic_ns: u64,
        kind: RawObservationKind,
        quality: RawSourceQuality,
        source_adapter: AdapterId,
        payload: serde_json::Value,
    ) -> Self {
        Self {
            observation_seq,
            session_id: session_id.into(),
            ts_monotonic_ns,
            kind,
            quality,
            source_adapter,
            payload,
        }
    }
}

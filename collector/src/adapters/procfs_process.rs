use std::collections::HashSet;
use std::path::PathBuf;
use std::time::Instant;

use crate::adapters::{AdapterError, CollectorAdapter};
use crate::capability::{AdapterCapabilityManifest, AdapterId, ObservationLane};
use crate::procfs_snapshot::{
    self, ProcessSampleRecord, ScanStats, PROVISIONAL_MAX_PROCFS_OBSERVATIONS_PER_POLL,
};
use crate::raw::{RawObservation, RawObservationKind, RawSourceQuality};

/// **Provisional:** max delta rows per direction per poll (bounds burst churn).
pub const PROVISIONAL_MAX_PROCFS_DELTA_PER_DIRECTION: usize = 64;

/// Stateful `/proc` process lane — Linux only emits observations; other OS stay inactive.
#[derive(Debug, Clone)]
pub struct ProcfsProcessAdapter {
    session_id: String,
    observation_seq: u64,
    procfs_root: PathBuf,
    last_pids: HashSet<u32>,
    /// Cap on per-PID `ProcessSample` rows per poll (full PID set still used for deltas).
    pub max_samples_per_poll: usize,
    started: Instant,
    /// When false, `poll_raw` returns empty (tests / disabled lane).
    pub enabled: bool,
}

impl Default for ProcfsProcessAdapter {
    fn default() -> Self {
        Self::new("glass-collector-session")
    }
}

impl ProcfsProcessAdapter {
    pub fn new(session_id: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            observation_seq: 0,
            procfs_root: PathBuf::from("/proc"),
            last_pids: HashSet::new(),
            max_samples_per_poll: 512,
            started: Instant::now(),
            enabled: true,
        }
    }

    /// Test hook: use a fake tree (e.g. tempdir with `proc/` layout).
    pub fn with_procfs_root(session_id: impl Into<String>, procfs_root: PathBuf) -> Self {
        let mut s = Self::new(session_id);
        s.procfs_root = procfs_root;
        s
    }

    fn monotonic_ns(&self) -> u64 {
        self.started.elapsed().as_nanos() as u64
    }

    fn next_seq(&mut self) -> u64 {
        self.observation_seq += 1;
        self.observation_seq
    }

    fn manifest_linux_active(&self) -> AdapterCapabilityManifest {
        AdapterCapabilityManifest {
            adapter_id: AdapterId::ProcfsProcess,
            lane: ObservationLane::ProcessUser,
            requires_privilege_for_full_fidelity: false,
            implementation_active: self.enabled,
            supports_today: vec![
                "procfs_numeric_pid_scan".to_string(),
                "bounded_process_snapshot_poll".to_string(),
                "per_pid_comm_status_stat_exe_best_effort".to_string(),
                "poll_gap_delta_seen_absent_honest_labels".to_string(),
            ],
            does_not_support_yet: vec![
                "kernel_exact_process_spawn_exit_timestamps".to_string(),
                "parent_child_temporal_truth".to_string(),
                "ebpf_correlation".to_string(),
                "container_namespace_boundary".to_string(),
            ],
        }
    }

    fn manifest_inactive(&self, reason: &'static str) -> AdapterCapabilityManifest {
        AdapterCapabilityManifest {
            adapter_id: AdapterId::ProcfsProcess,
            lane: ObservationLane::ProcessUser,
            requires_privilege_for_full_fidelity: false,
            implementation_active: false,
            supports_today: vec![format!("inactive:{reason}")],
            does_not_support_yet: vec![
                "linux_procfs_runtime_required".to_string(),
                "kernel_exact_process_spawn_exit_timestamps".to_string(),
            ],
        }
    }

    fn sample_payload(
        &self,
        rec: &ProcessSampleRecord,
        stats: &ScanStats,
        poll_monotonic_ns: u64,
    ) -> serde_json::Value {
        serde_json::json!({
            "semantics": "procfs_poll_snapshot",
            "not_kernel_lifecycle_event": true,
            "pid": rec.pid,
            "ppid": rec.ppid,
            "comm": rec.comm,
            "exe": rec.exe,
            "exe_note": rec.exe_note,
            "starttime_kernel_ticks": rec.starttime_kernel_ticks,
            "poll_monotonic_ns": poll_monotonic_ns,
            "scan": {
                "numeric_pids_seen": stats.numeric_pids_found,
                "samples_returned": stats.samples_built,
                "truncated_by_sample_budget": stats.truncated_by_sample_budget,
            },
        })
    }

    fn push_obs(
        &mut self,
        out: &mut Vec<RawObservation>,
        budget: usize,
        poll_ns: u64,
        kind: RawObservationKind,
        payload: serde_json::Value,
    ) {
        if out.len() >= budget {
            return;
        }
        let seq = self.next_seq();
        out.push(RawObservation::new(
            seq,
            self.session_id.clone(),
            poll_ns,
            kind,
            RawSourceQuality::ProcfsDerived,
            AdapterId::ProcfsProcess,
            payload,
        ));
    }

    fn poll_linux(&mut self) -> Result<Vec<RawObservation>, AdapterError> {
        if !self.enabled {
            return Ok(vec![]);
        }

        let budget = PROVISIONAL_MAX_PROCFS_OBSERVATIONS_PER_POLL;
        let sample_cap = self
            .max_samples_per_poll
            .min(budget.saturating_sub(PROVISIONAL_MAX_PROCFS_DELTA_PER_DIRECTION * 2));

        let all_pids = procfs_snapshot::enumerate_pids(&self.procfs_root)?;
        let current_pids: HashSet<u32> = all_pids.iter().copied().collect();
        let truncated = all_pids.len() > sample_cap;
        let mut records = Vec::new();
        for &pid in all_pids.iter().take(sample_cap) {
            if let Some(rec) = procfs_snapshot::sample_pid(&self.procfs_root, pid) {
                records.push(rec);
            }
        }
        let stats = ScanStats {
            proc_entries_seen: all_pids.len(),
            numeric_pids_found: all_pids.len(),
            samples_built: records.len(),
            truncated_by_sample_budget: truncated,
        };
        let poll_ns = self.monotonic_ns();

        let mut out: Vec<RawObservation> = Vec::new();

        if !self.last_pids.is_empty() {
            let mut appeared: Vec<u32> =
                current_pids.difference(&self.last_pids).copied().collect();
            appeared.sort_unstable();
            if appeared.len() > PROVISIONAL_MAX_PROCFS_DELTA_PER_DIRECTION {
                appeared.truncate(PROVISIONAL_MAX_PROCFS_DELTA_PER_DIRECTION);
            }
            for pid in appeared {
                self.push_obs(
                    &mut out,
                    budget,
                    poll_ns,
                    RawObservationKind::ProcessSeenInPollGap,
                    serde_json::json!({
                        "semantics": "procfs_poll_delta",
                        "pid": pid,
                        "honesty": "appeared_since_previous_poll_not_exact_spawn_time",
                    }),
                );
            }

            let mut vanished: Vec<u32> =
                self.last_pids.difference(&current_pids).copied().collect();
            vanished.sort_unstable();
            if vanished.len() > PROVISIONAL_MAX_PROCFS_DELTA_PER_DIRECTION {
                vanished.truncate(PROVISIONAL_MAX_PROCFS_DELTA_PER_DIRECTION);
            }
            for pid in vanished {
                self.push_obs(
                    &mut out,
                    budget,
                    poll_ns,
                    RawObservationKind::ProcessAbsentInPollGap,
                    serde_json::json!({
                        "semantics": "procfs_poll_delta",
                        "pid": pid,
                        "honesty": "absent_since_previous_poll_not_exact_exit_time",
                    }),
                );
            }
        }

        for rec in records {
            self.push_obs(
                &mut out,
                budget,
                poll_ns,
                RawObservationKind::ProcessSample,
                self.sample_payload(&rec, &stats, poll_ns),
            );
        }

        self.last_pids = current_pids;
        Ok(out)
    }
}

impl CollectorAdapter for ProcfsProcessAdapter {
    fn adapter_id(&self) -> AdapterId {
        AdapterId::ProcfsProcess
    }

    fn capability_manifest(&self) -> AdapterCapabilityManifest {
        if !cfg!(target_os = "linux") {
            return self.manifest_inactive("non_linux_target");
        }
        if !self.enabled {
            return self.manifest_inactive("adapter_disabled");
        }
        self.manifest_linux_active()
    }

    fn poll_raw(&mut self) -> Result<Vec<RawObservation>, AdapterError> {
        if !cfg!(target_os = "linux") {
            return Ok(vec![]);
        }
        self.poll_linux()
    }
}

//! Bounded **directory poll** file lane — honest semantics only.
//!
//! **Not** fanotify/inotify, **not** syscall-level read/write truth, **not** universal host file truth.
//! Observations are **root-bounded**, **polling-derived**, and may be **truncated** by caps.

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::Instant;

use crate::adapters::{AdapterError, CollectorAdapter};
use crate::capability::{AdapterCapabilityManifest, AdapterId, ObservationLane};
use crate::raw::{RawObservation, RawObservationKind, RawSourceQuality};

/// **Provisional:** max raw observations emitted in one `poll_raw` call (samples + deltas).
pub const PROVISIONAL_MAX_FS_FILE_OBSERVATIONS_PER_POLL: usize = 1024;
/// **Provisional:** max delta rows per direction per poll (bounds rename storms).
pub const PROVISIONAL_MAX_FS_DELTA_PER_DIRECTION: usize = 64;
/// **Provisional:** max paths retained between polls for honest gap comparison (may exceed sample emission cap).
pub const PROVISIONAL_MAX_FS_SCAN_PATHS_FOR_STATE: usize = 4096;
/// **Provisional:** default max directory depth under the watch root (1 = root files only).
pub const PROVISIONAL_DEFAULT_FS_MAX_DEPTH: usize = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
struct FileSig {
    size: u64,
    modified_unix_secs: u64,
}

fn rel_key_for(root: &Path, path: &Path) -> Option<String> {
    let rel = path.strip_prefix(root).ok()?;
    let s = rel.to_string_lossy();
    if s.is_empty() {
        return Some(".".to_string());
    }
    Some(s.replace('\\', "/"))
}

fn file_sig_for_path(path: &Path) -> std::io::Result<FileSig> {
    let m = std::fs::metadata(path)?;
    let modified_unix_secs = m
        .modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0);
    Ok(FileSig {
        size: m.len(),
        modified_unix_secs,
    })
}

/// Collect up to `max_paths` file paths under `root`, depth ≤ `max_depth`, stable relative keys.
/// Does **not** recurse into symlink directories (escapes bounded root).
/// `truncated` is true if scanning stopped early due to `max_paths` (more files may exist).
fn scan_tree(
    root: &Path,
    max_depth: usize,
    max_paths: usize,
) -> Result<(HashMap<String, FileSig>, bool), AdapterError> {
    let mut out: HashMap<String, FileSig> = HashMap::new();
    let truncated = walk(root, root, 0, max_depth, max_paths, &mut out)?;
    Ok((out, truncated))
}

fn walk(
    root: &Path,
    dir: &Path,
    depth: usize,
    max_depth: usize,
    max_paths: usize,
    out: &mut HashMap<String, FileSig>,
) -> Result<bool, AdapterError> {
    if depth > max_depth {
        return Ok(false);
    }
    let read = match std::fs::read_dir(dir) {
        Ok(r) => r,
        Err(e) => {
            return Err(AdapterError::Io(e));
        }
    };
    let mut truncated = false;
    for entry in read {
        if out.len() >= max_paths {
            truncated = true;
            break;
        }
        let entry = entry?;
        let path = entry.path();
        let ft = entry.file_type()?;

        if ft.is_symlink() {
            let sm = std::fs::symlink_metadata(&path)?;
            if sm.is_dir() {
                continue;
            }
        } else if ft.is_dir() {
            if walk(root, &path, depth + 1, max_depth, max_paths, out)? {
                truncated = true;
            }
            continue;
        }

        if !ft.is_file() && !ft.is_symlink() {
            continue;
        }

        let Some(key) = rel_key_for(root, &path) else {
            continue;
        };
        let sig = match file_sig_for_path(&path) {
            Ok(s) => s,
            Err(_) => continue,
        };
        out.insert(key, sig);
        if out.len() >= max_paths {
            truncated = true;
        }
    }
    Ok(truncated)
}

/// Stateful bounded file tree poll under an optional declared root.
#[derive(Debug, Clone)]
pub struct FsFileLaneAdapter {
    session_id: String,
    observation_seq: u64,
    /// When `None`, lane is **inactive** (no observations; declaration-only manifest).
    pub watch_root: Option<PathBuf>,
    last_files: HashMap<String, FileSig>,
    /// After first successful scan, gap deltas are meaningful.
    has_prior_poll: bool,
    pub max_files_per_scan: usize,
    pub max_depth: usize,
    pub enabled: bool,
    started: Instant,
}

impl Default for FsFileLaneAdapter {
    fn default() -> Self {
        Self::new("glass-collector-session")
    }
}

impl FsFileLaneAdapter {
    pub fn new(session_id: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            observation_seq: 0,
            watch_root: None,
            last_files: HashMap::new(),
            has_prior_poll: false,
            max_files_per_scan: 512,
            max_depth: PROVISIONAL_DEFAULT_FS_MAX_DEPTH,
            enabled: true,
            started: Instant::now(),
        }
    }

    pub fn with_watch_root(session_id: impl Into<String>, root: PathBuf) -> Self {
        let mut s = Self::new(session_id);
        s.watch_root = Some(root);
        s
    }

    fn monotonic_ns(&self) -> u64 {
        self.started.elapsed().as_nanos() as u64
    }

    fn next_seq(&mut self) -> u64 {
        self.observation_seq += 1;
        self.observation_seq
    }

    fn manifest_active(&self) -> AdapterCapabilityManifest {
        AdapterCapabilityManifest {
            adapter_id: AdapterId::FsFileLane,
            lane: ObservationLane::FileSystem,
            requires_privilege_for_full_fidelity: false,
            implementation_active: true,
            supports_today: vec![
                "bounded_directory_poll_snapshot".to_string(),
                "declared_watch_root_only_not_global_host_truth".to_string(),
                "poll_gap_created_missing_changed_honest_labels".to_string(),
                "max_files_and_depth_caps_with_truncation_flags".to_string(),
            ],
            does_not_support_yet: vec![
                "fanotify_open_access".to_string(),
                "inotify_user_live_stream".to_string(),
                "kernel_syscall_read_write_exact_truth".to_string(),
                "rename_pair_atomic_truth".to_string(),
                "cross_mount_and_namespace_complete_view".to_string(),
            ],
        }
    }

    fn manifest_inactive(&self, reason: &'static str) -> AdapterCapabilityManifest {
        AdapterCapabilityManifest {
            adapter_id: AdapterId::FsFileLane,
            lane: ObservationLane::FileSystem,
            requires_privilege_for_full_fidelity: false,
            implementation_active: false,
            supports_today: vec![format!("inactive:{reason}")],
            does_not_support_yet: vec![
                "fanotify_open_access".to_string(),
                "inotify_user_live_stream".to_string(),
                "kernel_syscall_read_write_exact_truth".to_string(),
            ],
        }
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
            RawSourceQuality::DirectoryPollDerived,
            AdapterId::FsFileLane,
            payload,
        ));
    }

    fn poll_impl(&mut self) -> Result<Vec<RawObservation>, AdapterError> {
        if !self.enabled {
            return Ok(vec![]);
        }
        let Some(root) = self.watch_root.clone() else {
            return Ok(vec![]);
        };
        if !root.is_dir() {
            return Ok(vec![]);
        }

        let budget = PROVISIONAL_MAX_FS_FILE_OBSERVATIONS_PER_POLL;
        let sample_cap = self
            .max_files_per_scan
            .min(budget.saturating_sub(PROVISIONAL_MAX_FS_DELTA_PER_DIRECTION * 3));

        let (current, state_truncated) = scan_tree(
            &root,
            self.max_depth,
            PROVISIONAL_MAX_FS_SCAN_PATHS_FOR_STATE,
        )?;
        let files_seen_total = current.len();
        let truncated_by_sample_budget = files_seen_total > sample_cap;

        let poll_ns = self.monotonic_ns();

        let mut out: Vec<RawObservation> = Vec::new();

        let watch_root_display = root.display().to_string();

        if self.has_prior_poll {
            let prev_keys: HashSet<&String> = self.last_files.keys().collect();
            let curr_keys: HashSet<&String> = current.keys().collect();

            let mut created: Vec<String> = current
                .keys()
                .filter(|k| !prev_keys.contains(*k))
                .cloned()
                .collect();
            created.sort();
            if created.len() > PROVISIONAL_MAX_FS_DELTA_PER_DIRECTION {
                created.truncate(PROVISIONAL_MAX_FS_DELTA_PER_DIRECTION);
            }
            for rel in created {
                self.push_obs(
                    &mut out,
                    budget,
                    poll_ns,
                    RawObservationKind::FileCreatedInPollGap,
                    serde_json::json!({
                        "semantics": "directory_poll_delta",
                        "not_syscall_file_create": true,
                        "relative_path": rel,
                        "honesty": "appeared_since_previous_poll_not_exact_create_syscall_or_time",
                        "watch_root": watch_root_display,
                        "state_budget_truncated": state_truncated,
                    }),
                );
            }

            let mut missing: Vec<String> = self
                .last_files
                .keys()
                .filter(|k| !curr_keys.contains(k))
                .cloned()
                .collect();
            missing.sort();
            if missing.len() > PROVISIONAL_MAX_FS_DELTA_PER_DIRECTION {
                missing.truncate(PROVISIONAL_MAX_FS_DELTA_PER_DIRECTION);
            }
            for rel in missing {
                self.push_obs(
                    &mut out,
                    budget,
                    poll_ns,
                    RawObservationKind::FileMissingInPollGap,
                    serde_json::json!({
                        "semantics": "directory_poll_delta",
                        "not_syscall_file_delete": true,
                        "relative_path": rel,
                        "honesty": "absent_since_previous_poll_not_exact_delete_syscall_or_time",
                        "watch_root": watch_root_display,
                        "state_budget_truncated": state_truncated,
                    }),
                );
            }

            let mut changed: Vec<String> = Vec::new();
            for (k, sig_new) in &current {
                if let Some(sig_old) = self.last_files.get(k) {
                    if sig_old != sig_new {
                        changed.push(k.clone());
                    }
                }
            }
            changed.sort();
            if changed.len() > PROVISIONAL_MAX_FS_DELTA_PER_DIRECTION {
                changed.truncate(PROVISIONAL_MAX_FS_DELTA_PER_DIRECTION);
            }
            for rel in changed {
                let sig = current.get(&rel).copied();
                self.push_obs(
                    &mut out,
                    budget,
                    poll_ns,
                    RawObservationKind::FileChangedBetweenPolls,
                    serde_json::json!({
                        "semantics": "directory_poll_delta",
                        "not_syscall_read_or_write": true,
                        "relative_path": rel,
                        "honesty": "metadata_or_size_diff_between_polls_not_io_operation_truth",
                        "size_bytes": sig.map(|s| s.size),
                        "modified_unix_secs": sig.map(|s| s.modified_unix_secs),
                        "watch_root": watch_root_display,
                        "state_budget_truncated": state_truncated,
                    }),
                );
            }
        }

        let mut sample_keys: Vec<String> = current.keys().cloned().collect();
        sample_keys.sort();
        sample_keys.truncate(sample_cap);
        let samples_returned = sample_keys.len();

        for rel in sample_keys {
            let sig = current.get(&rel).copied().unwrap_or(FileSig {
                size: 0,
                modified_unix_secs: 0,
            });
            self.push_obs(
                &mut out,
                budget,
                poll_ns,
                RawObservationKind::FileSeenInPollSnapshot,
                serde_json::json!({
                    "semantics": "bounded_directory_poll_snapshot",
                    "not_syscall_file_access": true,
                    "relative_path": rel,
                    "size_bytes": sig.size,
                    "modified_unix_secs": sig.modified_unix_secs,
                    "poll_monotonic_ns": poll_ns,
                    "scan": {
                        "files_seen_total": files_seen_total,
                        "samples_returned": samples_returned,
                        "truncated_by_sample_budget": truncated_by_sample_budget,
                        "state_budget_truncated": state_truncated,
                        "max_depth": self.max_depth,
                    },
                    "watch_root": watch_root_display,
                    "first_poll_baseline": !self.has_prior_poll,
                }),
            );
        }

        self.last_files = current;
        self.has_prior_poll = true;

        Ok(out)
    }
}

impl CollectorAdapter for FsFileLaneAdapter {
    fn adapter_id(&self) -> AdapterId {
        AdapterId::FsFileLane
    }

    fn capability_manifest(&self) -> AdapterCapabilityManifest {
        if !self.enabled {
            return self.manifest_inactive("adapter_disabled");
        }
        match &self.watch_root {
            None => self.manifest_inactive("no_watch_root_configured"),
            Some(r) if !r.is_dir() => self.manifest_inactive("watch_root_not_a_directory"),
            Some(_) => self.manifest_active(),
        }
    }

    fn poll_raw(&mut self) -> Result<Vec<RawObservation>, AdapterError> {
        self.poll_impl()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rel_key_normalizes_separators() {
        let root = PathBuf::from(r"C:\tmp\w");
        let p = PathBuf::from(r"C:\tmp\w\a\b.txt");
        let k = rel_key_for(&root, &p).unwrap();
        assert_eq!(k, "a/b.txt");
    }
}

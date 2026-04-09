//! Bounded `/proc` process sampling — **snapshot / poll semantics only** (not kernel spawn/exit truth).
//!
//! **Provisional:** max PIDs scanned and max samples per poll — see `docs/PHASE0_FREEZE_TRACKER.md`.

use std::fs;
use std::path::Path;

/// **Provisional:** upper bound on numeric `/proc` entries examined (DoS / slow machine).
pub const PROVISIONAL_MAX_PROC_ENTRIES_SCANNED: usize = 16_384;

/// **Provisional:** max process observations emitted per `poll_raw` call (samples + delta rows).
pub const PROVISIONAL_MAX_PROCFS_OBSERVATIONS_PER_POLL: usize = 1024;

/// One process row from a single poll.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessSampleRecord {
    pub pid: u32,
    pub ppid: Option<u32>,
    pub comm: String,
    pub exe: Option<String>,
    /// If `exe` is missing, why (permission, gone, etc.).
    pub exe_note: Option<String>,
    /// Field 22 from `/proc/pid/stat` (kernel jiffies since boot), if parsed.
    pub starttime_kernel_ticks: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScanStats {
    pub proc_entries_seen: usize,
    pub numeric_pids_found: usize,
    pub samples_built: usize,
    pub truncated_by_sample_budget: bool,
}

/// Parse `/proc/pid/comm` (single line, may end with newline).
pub fn parse_comm_file(content: &str) -> String {
    content.trim().to_string()
}

/// Parse `PPid:` line from `/proc/pid/status`.
pub fn parse_status_ppid(content: &str) -> Option<u32> {
    for line in content.lines() {
        if let Some(rest) = line.strip_prefix("PPid:") {
            return rest.trim().parse().ok();
        }
    }
    None
}

/// After the closing `)` of `comm` in `/proc/pid/stat`, fields are whitespace-separated; **starttime** is 1-based field 22 → 0-based index **19** after the post-comm token list.
pub fn parse_stat_starttime_ticks(stat_content: &str) -> Option<u64> {
    let rp = stat_content.rfind(')')?;
    let rest = stat_content[rp + 1..].trim_start();
    let tok: Vec<&str> = rest.split_whitespace().collect();
    tok.get(19)?.parse().ok()
}

fn read_file_lossy(path: &Path) -> Option<String> {
    fs::read_to_string(path).ok()
}

/// Build one sample record for `pid` under `procfs_root` (typically `/proc`).
pub fn sample_pid(procfs_root: &Path, pid: u32) -> Option<ProcessSampleRecord> {
    let p = procfs_root.join(pid.to_string());
    let comm = read_file_lossy(&p.join("comm")).map(|c| parse_comm_file(&c))?;
    let status = read_file_lossy(&p.join("status")).unwrap_or_default();
    let ppid = parse_status_ppid(&status);
    let starttime_kernel_ticks = read_file_lossy(&p.join("stat"))
        .as_deref()
        .and_then(parse_stat_starttime_ticks);

    let exe_path = p.join("exe");
    let (exe, exe_note) = match fs::read_link(&exe_path) {
        Ok(pb) => (Some(pb.to_string_lossy().into_owned()), None),
        Err(e) => (None, Some(format!("exe_unreadable:{}", io_err_kind(&e)))),
    };

    Some(ProcessSampleRecord {
        pid,
        ppid,
        comm,
        exe,
        exe_note,
        starttime_kernel_ticks,
    })
}

fn io_err_kind(e: &std::io::Error) -> &'static str {
    use std::io::ErrorKind;
    match e.kind() {
        ErrorKind::PermissionDenied => "permission_denied",
        ErrorKind::NotFound => "not_found",
        _ => "other",
    }
}

/// Enumerate numeric PIDs under `procfs_root`, sorted, capped.
pub fn enumerate_pids(procfs_root: &Path) -> std::io::Result<Vec<u32>> {
    let mut pids = Vec::new();
    for ent in fs::read_dir(procfs_root)? {
        let ent = ent?;
        let name = ent.file_name();
        let name = name.to_string_lossy();
        if let Ok(n) = name.parse::<u32>() {
            pids.push(n);
        }
    }
    pids.sort_unstable();
    if pids.len() > PROVISIONAL_MAX_PROC_ENTRIES_SCANNED {
        pids.truncate(PROVISIONAL_MAX_PROC_ENTRIES_SCANNED);
    }
    Ok(pids)
}

/// Build sample records for the first `max_samples` PIDs (sorted order). `truncated` if more PIDs existed than sampled.
pub fn sample_records_bounded(
    procfs_root: &Path,
    max_samples: usize,
) -> std::io::Result<(Vec<ProcessSampleRecord>, ScanStats)> {
    let all = enumerate_pids(procfs_root)?;
    let numeric = all.len();
    let truncated = numeric > max_samples;
    let mut records = Vec::new();
    for &pid in all.iter().take(max_samples) {
        if let Some(rec) = sample_pid(procfs_root, pid) {
            records.push(rec);
        }
    }
    let stats = ScanStats {
        proc_entries_seen: numeric,
        numeric_pids_found: numeric,
        samples_built: records.len(),
        truncated_by_sample_budget: truncated,
    };
    Ok((records, stats))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_comm_trims() {
        assert_eq!(parse_comm_file("systemd\n"), "systemd");
    }

    #[test]
    fn parse_ppid_line() {
        let s = "Name:foo\nPPid:\t1234\n";
        assert_eq!(parse_status_ppid(s), Some(1234));
    }

    #[test]
    fn parse_stat_starttime_simple() {
        // After `)`, tokens[0]=state … tokens[19]=starttime (man proc 5, field 22).
        let stat = "42 (foo) S 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 999 0";
        assert_eq!(parse_stat_starttime_ticks(stat), Some(999));
    }

    #[test]
    fn sample_records_bounded_truncates() {
        let tmp = tempfile::tempdir().unwrap();
        let proc = tmp.path().join("proc");
        std::fs::create_dir(&proc).unwrap();
        for pid in [1u32, 2, 3] {
            let d = proc.join(pid.to_string());
            std::fs::create_dir(&d).unwrap();
            std::fs::write(d.join("comm"), format!("p{pid}\n")).unwrap();
            std::fs::write(d.join("status"), "PPid:\t0\n").unwrap();
            std::fs::write(
                d.join("stat"),
                format!("{pid} (p{pid}) S 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 100{pid} 0\n"),
            )
            .unwrap();
        }
        let (recs, st) = super::sample_records_bounded(&proc, 2).unwrap();
        assert_eq!(recs.len(), 2);
        assert!(st.truncated_by_sample_budget);
    }
}

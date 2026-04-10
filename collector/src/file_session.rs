//! Fs file-lane raw observations → `session_engine` DTOs and session append (**no** sanitization here).

use std::path::PathBuf;

use session_engine::{FileLaneRawObservationDto, SessionEngineError, SessionLog};

use crate::adapters::{CollectorAdapter, FsFileLaneAdapter};
use crate::capability::AdapterId;
use crate::pipeline::filter_for_normalization_input;
use crate::raw::{RawObservation, RawObservationKind};
use crate::self_silence::SelfSilencePolicy;

fn raw_kind_str(kind: &RawObservationKind) -> Option<&'static str> {
    match kind {
        RawObservationKind::FileSeenInPollSnapshot => Some("file_seen_in_poll_snapshot"),
        RawObservationKind::FileChangedBetweenPolls => Some("file_changed_between_polls"),
        RawObservationKind::FileMissingInPollGap => Some("file_missing_in_poll_gap"),
        RawObservationKind::FileCreatedInPollGap => Some("file_created_in_poll_gap"),
        _ => None,
    }
}

/// Map one raw row if it is an fs file-lane observation we normalize today.
pub fn raw_to_file_lane_dto(raw: &RawObservation) -> Option<FileLaneRawObservationDto> {
    if raw.source_adapter != AdapterId::FsFileLane {
        return None;
    }
    let raw_kind = raw_kind_str(&raw.kind)?.to_string();
    Some(FileLaneRawObservationDto {
        observation_seq: raw.observation_seq,
        session_id: raw.session_id.clone(),
        ts_monotonic_ns: raw.ts_monotonic_ns,
        raw_kind,
        payload: raw.payload.clone(),
    })
}

pub fn file_lane_dtos_from_raw(obs: &[RawObservation]) -> Vec<FileLaneRawObservationDto> {
    obs.iter().filter_map(raw_to_file_lane_dto).collect()
}

/// Self-silence → file-lane DTOs → ordered session log.
pub fn ingest_file_lane_raw_to_session_log(
    observations: Vec<RawObservation>,
    policy: &SelfSilencePolicy,
) -> Result<SessionLog, SessionEngineError> {
    let (kept, _) = filter_for_normalization_input(observations, policy);
    let dtos = file_lane_dtos_from_raw(&kept);
    let mut log = SessionLog::new();
    log.append_file_lane_dtos(&dtos)?;
    Ok(log)
}

/// Load `RawObservation[]` for `normalize-file-lane` / tests: fixture JSON or live polls under `watch_root`.
pub fn load_file_lane_observations_for_cli(
    session: String,
    watch_root: PathBuf,
    max_samples: usize,
    max_depth: usize,
    twice: bool,
    from_raw_json: Option<PathBuf>,
) -> Result<Vec<RawObservation>, String> {
    match from_raw_json {
        Some(path) => {
            let s = std::fs::read_to_string(&path)
                .map_err(|e| format!("read {}: {e}", path.display()))?;
            serde_json::from_str(&s).map_err(|e| format!("parse raw JSON: {e}"))
        }
        None => {
            if !watch_root.is_dir() {
                return Err(format!(
                    "watch root {} is not a directory",
                    watch_root.display()
                ));
            }
            let mut a = FsFileLaneAdapter::with_watch_root(session, watch_root);
            a.max_files_per_scan = max_samples;
            a.max_depth = max_depth;
            let mut batch = a.poll_raw().map_err(|e| format!("poll: {e}"))?;
            if twice {
                match a.poll_raw() {
                    Ok(b2) => batch.extend(b2),
                    Err(e) => eprintln!("second poll: {e}"),
                }
            }
            Ok(batch)
        }
    }
}

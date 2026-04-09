//! Procfs raw observations → `session_engine` DTOs and session append (**no** sanitization here).

use session_engine::{ProcfsRawObservationDto, SessionEngineError, SessionLog};

use crate::capability::AdapterId;
use crate::pipeline::filter_for_normalization_input;
use crate::raw::{RawObservation, RawObservationKind};
use crate::self_silence::SelfSilencePolicy;

/// Map one raw row if it is a procfs-process observation we normalize today.
pub fn raw_to_procfs_dto(raw: &RawObservation) -> Option<ProcfsRawObservationDto> {
    if raw.source_adapter != AdapterId::ProcfsProcess {
        return None;
    }
    let raw_kind = match &raw.kind {
        RawObservationKind::ProcessSample => "process_sample",
        RawObservationKind::ProcessSeenInPollGap => "process_seen_in_poll_gap",
        RawObservationKind::ProcessAbsentInPollGap => "process_absent_in_poll_gap",
        _ => return None,
    };
    Some(ProcfsRawObservationDto {
        observation_seq: raw.observation_seq,
        session_id: raw.session_id.clone(),
        ts_monotonic_ns: raw.ts_monotonic_ns,
        raw_kind: raw_kind.to_string(),
        payload: raw.payload.clone(),
    })
}

pub fn procfs_dtos_from_raw(obs: &[RawObservation]) -> Vec<ProcfsRawObservationDto> {
    obs.iter().filter_map(raw_to_procfs_dto).collect()
}

/// Self-silence → procfs DTOs → ordered session log.
pub fn ingest_procfs_raw_to_session_log(
    observations: Vec<RawObservation>,
    policy: &SelfSilencePolicy,
) -> Result<SessionLog, SessionEngineError> {
    let (kept, _) = filter_for_normalization_input(observations, policy);
    let dtos = procfs_dtos_from_raw(&kept);
    let mut log = SessionLog::new();
    log.append_procfs_dtos(&dtos)?;
    Ok(log)
}

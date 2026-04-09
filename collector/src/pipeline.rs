//! Hot path: **raw** observations → self-silence filter → **normalization input** (still raw type).
//!
//! Normalized envelopes and export sanitization live in `session_engine` — not here.

use crate::raw::RawObservation;
use crate::self_silence::{should_suppress_raw, SelfSilenceCounters, SelfSilencePolicy};

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PipelineStats {
    pub silence: SelfSilenceCounters,
    pub forwarded_to_normalize: u64,
}

/// Apply self-silence **before** any normalization. Returns (kept, stats).
pub fn filter_for_normalization_input(
    observations: Vec<RawObservation>,
    policy: &SelfSilencePolicy,
) -> (Vec<RawObservation>, PipelineStats) {
    let mut silence = SelfSilenceCounters::default();
    let mut kept = Vec::new();
    for obs in observations {
        silence.raw_observations_examined += 1;
        if should_suppress_raw(&obs, policy) {
            silence.suppressed_before_normalize += 1;
            continue;
        }
        kept.push(obs);
    }
    let forwarded_to_normalize = kept.len() as u64;
    (
        kept,
        PipelineStats {
            silence,
            forwarded_to_normalize,
        },
    )
}

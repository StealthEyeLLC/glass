use std::path::Path;

use crate::error::{PackError, SessionEngineError};
use crate::event::NormalizedEventEnvelope;
use crate::events_seg;
use crate::manifest::SessionManifest;
use crate::pack::{
    read_glass_pack_bytes_level, write_glass_pack_scaffold_seg_to_vec, write_glass_pack_to_vec,
};
use crate::procfs_normalize::{normalize_procfs_observation, ProcfsRawObservationDto};
use crate::validate::PackValidationLevel;

/// In-memory append-only session log (authoritative ordering for tests and future session engine).
#[derive(Debug, Default, Clone)]
pub struct SessionLog {
    events: Vec<NormalizedEventEnvelope>,
    next_seq: u64,
}

impl SessionLog {
    pub fn new() -> Self {
        Self {
            events: Vec::new(),
            next_seq: 1,
        }
    }

    /// Rebuild log from pack-ordered events (1-based consecutive `seq`).
    pub fn from_pack_events(
        events: Vec<NormalizedEventEnvelope>,
    ) -> Result<Self, SessionEngineError> {
        let mut expected = 1u64;
        for e in &events {
            if e.seq != expected {
                return Err(SessionEngineError::SeqOrder {
                    expected,
                    got: e.seq,
                });
            }
            expected += 1;
        }
        Ok(Self {
            next_seq: expected,
            events,
        })
    }

    /// Read `.glass_pack` bytes into a log + manifest (`Basic` validation).
    pub fn load_from_pack_bytes(
        bytes: &[u8],
    ) -> Result<(Self, SessionManifest), SessionEngineError> {
        Self::load_from_pack_bytes_level(bytes, PackValidationLevel::Basic)
    }

    pub fn load_from_pack_bytes_strict(
        bytes: &[u8],
    ) -> Result<(Self, SessionManifest), SessionEngineError> {
        Self::load_from_pack_bytes_level(bytes, PackValidationLevel::StrictKinds)
    }

    fn load_from_pack_bytes_level(
        bytes: &[u8],
        level: PackValidationLevel,
    ) -> Result<(Self, SessionManifest), SessionEngineError> {
        let (m, evs) =
            read_glass_pack_bytes_level(bytes, level).map_err(SessionEngineError::Pack)?;
        let log = SessionLog::from_pack_events(evs)?;
        Ok((log, m))
    }

    /// Serialize current events using `manifest` (caller aligns `manifest.session_id` with events).
    pub fn materialize_pack(&self, manifest: &SessionManifest) -> Result<Vec<u8>, PackError> {
        write_glass_pack_to_vec(manifest, &self.events)
    }

    /// Same as [`materialize_pack`](Self::materialize_pack) but `glass.pack.v0.scaffold_seg` + `events.seg` payload.
    pub fn materialize_pack_scaffold_seg(
        &self,
        manifest: &SessionManifest,
    ) -> Result<Vec<u8>, PackError> {
        write_glass_pack_scaffold_seg_to_vec(manifest, &self.events)
    }

    /// Load log from a standalone `events.seg` file (same record format as inside seg packs).
    pub fn from_seg_path(path: &Path) -> Result<Self, SessionEngineError> {
        let evs = events_seg::read_segment_file(path).map_err(SessionEngineError::Seg)?;
        Self::from_pack_events(evs)
    }

    /// Write this log to a standalone `events.seg` file (truncate).
    pub fn write_seg_path(&self, path: &Path) -> Result<(), SessionEngineError> {
        events_seg::write_segment_file(path, &self.events).map_err(SessionEngineError::Seg)?;
        Ok(())
    }

    /// Append with explicit `seq` matching the next expected sequence.
    pub fn append(&mut self, event: NormalizedEventEnvelope) -> Result<(), SessionEngineError> {
        if event.seq != self.next_seq {
            return Err(SessionEngineError::SeqOrder {
                expected: self.next_seq,
                got: event.seq,
            });
        }
        self.next_seq += 1;
        self.events.push(event);
        Ok(())
    }

    /// Assign monotonic `seq` automatically.
    pub fn push_fresh(
        &mut self,
        mut event: NormalizedEventEnvelope,
    ) -> Result<(), SessionEngineError> {
        event.seq = self.next_seq;
        self.next_seq += 1;
        self.events.push(event);
        Ok(())
    }

    pub fn events(&self) -> &[NormalizedEventEnvelope] {
        &self.events
    }

    pub fn len(&self) -> usize {
        self.events.len()
    }

    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }

    pub fn next_seq(&self) -> u64 {
        self.next_seq
    }

    /// Append procfs raw DTOs as normalized session events (ordered); assigns consecutive `seq`.
    pub fn append_procfs_dtos(
        &mut self,
        dtos: &[ProcfsRawObservationDto],
    ) -> Result<(), SessionEngineError> {
        for dto in dtos {
            let ev = normalize_procfs_observation(dto, self.next_seq())?;
            self.push_fresh(ev)?;
        }
        Ok(())
    }
}

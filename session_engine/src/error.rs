use thiserror::Error;

use crate::events_seg::SegError;
use crate::file_lane_normalize::FileLaneNormalizeError;
use crate::procfs_normalize::ProcfsNormalizeError;

#[derive(Debug, Error)]
pub enum PackError {
    #[error("IO: {0}")]
    Io(#[from] std::io::Error),
    #[error("ZIP: {0}")]
    Zip(#[from] zip::result::ZipError),
    #[error("JSON: {0}")]
    Json(#[from] serde_json::Error),
    #[error("missing required entry in pack: {0}")]
    MissingEntry(&'static str),
    #[error("invalid pack: {0}")]
    Invalid(&'static str),
    #[error("events.seg: {0}")]
    Seg(#[from] SegError),
}

impl From<&'static str> for PackError {
    fn from(msg: &'static str) -> Self {
        PackError::Invalid(msg)
    }
}

#[derive(Debug, Error)]
pub enum SessionEngineError {
    #[error("pack: {0}")]
    Pack(#[from] PackError),
    #[error("segment: {0}")]
    Seg(#[from] SegError),
    #[error("seq out of order: expected {expected}, got {got}")]
    SeqOrder { expected: u64, got: u64 },
    #[error("procfs normalization: {0}")]
    ProcfsNormalize(#[from] ProcfsNormalizeError),
    #[error("file lane normalization: {0}")]
    FileLaneNormalize(#[from] FileLaneNormalizeError),
}

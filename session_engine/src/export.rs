//! Pack export helpers (sanitization + manifest fields). Pure — no I/O.

use crate::error::PackError;
use crate::event::NormalizedEventEnvelope;
use crate::manifest::SessionManifest;
use crate::pack::write_glass_pack_to_vec;
use crate::sanitization::{sanitize_events_for_share, SanitizationProfile, SanitizationResult};

/// Apply sanitization output to manifest share-safe fields (operator still reviews before public post).
pub fn apply_sanitization_to_manifest(m: &mut SessionManifest, result: &SanitizationResult) {
    m.sanitized = true;
    m.export_sanitization_profile = Some("sanitize_default".to_string());
    m.sanitization_profile_version = Some(result.profile_version.clone());
    m.human_readable_redaction_summary = result.human_readable_redaction_summary.clone();
    m.share_safe_recommended = false;
}

/// Build a **share-safe** `glass.pack.v0.scaffold` ZIP from already-normalized events (e.g. procfs session log).
/// Runs [`sanitize_events_for_share`] and merges redaction metadata into a [`SessionManifest::procfs_poll_dev_scaffold`] base.
pub fn materialize_share_safe_procfs_pack_bytes(
    events: &[NormalizedEventEnvelope],
    session_id: &str,
) -> Result<Vec<u8>, PackError> {
    let result = sanitize_events_for_share(
        events,
        SanitizationProfile {
            home_dir_prefix: None,
        },
    );
    let mut manifest = SessionManifest::procfs_poll_dev_scaffold(session_id);
    apply_sanitization_to_manifest(&mut manifest, &result);
    write_glass_pack_to_vec(&manifest, &result.events)
}

/// Build a **share-safe** `glass.pack.v0.scaffold` ZIP from **file-lane** normalized events (directory-poll kinds).
/// Uses the same [`sanitize_events_for_share`] pipeline as procfs export; manifest base labels the fs file lane adapter.
/// **Provisional** — F-05 path policy for file-lane attrs is not frozen (`SANITIZE_PROFILE_VERSION`).
pub fn materialize_share_safe_file_lane_pack_bytes(
    events: &[NormalizedEventEnvelope],
    session_id: &str,
) -> Result<Vec<u8>, PackError> {
    let result = sanitize_events_for_share(
        events,
        SanitizationProfile {
            home_dir_prefix: None,
        },
    );
    let mut manifest = SessionManifest::file_lane_poll_dev_scaffold(session_id);
    apply_sanitization_to_manifest(&mut manifest, &result);
    write_glass_pack_to_vec(&manifest, &result.events)
}

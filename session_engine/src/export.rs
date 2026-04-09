//! Pack export helpers (sanitization + manifest fields). Pure — no I/O.

use crate::manifest::SessionManifest;
use crate::sanitization::SanitizationResult;

/// Apply sanitization output to manifest share-safe fields (operator still reviews before public post).
pub fn apply_sanitization_to_manifest(m: &mut SessionManifest, result: &SanitizationResult) {
    m.sanitized = true;
    m.export_sanitization_profile = Some("sanitize_default".to_string());
    m.sanitization_profile_version = Some(result.profile_version.clone());
    m.human_readable_redaction_summary = result.human_readable_redaction_summary.clone();
    m.share_safe_recommended = false;
}

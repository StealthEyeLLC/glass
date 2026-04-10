//! Bounded snapshot cursor + [`crate::resync::ResyncHint`] mapping (F-03 / F-04 — still provisional).
//!
//! Decision options: `docs/F03_F04_FREEZE_PROPOSAL.md`.

use glass_collector::ipc::FipcBoundedSnapshotMeta;

use crate::http_types::{BoundedSnapshotContractV0, CURSOR_SEMANTICS_BOUNDED_PREFIX_V0};
use crate::resync::{
    ResyncHint, RESYNC_HINT_REASON_BOUNDED_TRUNCATION,
    RESYNC_HINT_REASON_PER_RPC_POLL_NOT_INCREMENTAL, RESYNC_HINT_REASON_RETAINED_TAIL_REPLACES,
};

/// Build HTTP `bounded_snapshot` view + optional honest `resync_hint` from collector F-IPC metadata.
pub fn bounded_http_from_fipc_meta(
    meta: &FipcBoundedSnapshotMeta,
    snapshot_cursor: &str,
    retained_snapshot_unix_ms: Option<u64>,
) -> (BoundedSnapshotContractV0, Option<ResyncHint>) {
    let view = BoundedSnapshotContractV0 {
        snapshot_origin: meta.snapshot_origin.clone(),
        returned_events: meta.returned_events,
        available_in_view: meta.available_in_view,
        truncated_by_max_events: meta.truncated_by_max_events,
        cursor_semantics: CURSOR_SEMANTICS_BOUNDED_PREFIX_V0,
    };

    let hint = resync_hint_from_fipc(meta, snapshot_cursor, retained_snapshot_unix_ms);
    (view, hint)
}

fn resync_hint_from_fipc(
    meta: &FipcBoundedSnapshotMeta,
    snapshot_cursor: &str,
    retained_snapshot_unix_ms: Option<u64>,
) -> Option<ResyncHint> {
    if meta.snapshot_origin == glass_collector::ipc::FIPC_SNAPSHOT_ORIGIN_UNKNOWN_OR_EMPTY {
        return None;
    }
    if meta.truncated_by_max_events {
        return Some(ResyncHint {
            reason: RESYNC_HINT_REASON_BOUNDED_TRUNCATION.to_string(),
            snapshot_cursor: snapshot_cursor.to_string(),
            detail: Some(format!(
                "more_events_exist_in_view available_in_view={} returned={}",
                meta.available_in_view, meta.returned_events
            )),
        });
    }
    if meta.snapshot_origin == glass_collector::ipc::FIPC_SNAPSHOT_ORIGIN_PER_RPC_PROCFS
        || meta.snapshot_origin == glass_collector::ipc::FIPC_SNAPSHOT_ORIGIN_PER_RPC_FILE_LANE
    {
        return Some(ResyncHint {
            reason: RESYNC_HINT_REASON_PER_RPC_POLL_NOT_INCREMENTAL.to_string(),
            snapshot_cursor: snapshot_cursor.to_string(),
            detail: Some(
                "each snapshot RPC may run a fresh poll; snapshot_cursor is not a delta continuation token"
                    .to_string(),
            ),
        });
    }
    if meta.snapshot_origin == glass_collector::ipc::FIPC_SNAPSHOT_ORIGIN_COLLECTOR_STORE
        && retained_snapshot_unix_ms.is_some()
    {
        return Some(ResyncHint {
            reason: RESYNC_HINT_REASON_RETAINED_TAIL_REPLACES.to_string(),
            snapshot_cursor: snapshot_cursor.to_string(),
            detail: Some(
                "retained loop replaces a bounded tail in the collector store each poll; no append-only history"
                    .to_string(),
            ),
        });
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use glass_collector::ipc::{
        FIPC_SNAPSHOT_ORIGIN_COLLECTOR_STORE, FIPC_SNAPSHOT_ORIGIN_PER_RPC_FILE_LANE,
        FIPC_SNAPSHOT_ORIGIN_PER_RPC_PROCFS, FIPC_SNAPSHOT_ORIGIN_UNKNOWN_OR_EMPTY,
    };

    fn meta(
        origin: &str,
        returned: u32,
        available: u32,
        truncated: bool,
    ) -> FipcBoundedSnapshotMeta {
        FipcBoundedSnapshotMeta {
            snapshot_origin: origin.to_string(),
            returned_events: returned,
            available_in_view: available,
            truncated_by_max_events: truncated,
        }
    }

    #[test]
    fn unknown_origin_never_emits_resync_hint() {
        let m = meta(FIPC_SNAPSHOT_ORIGIN_UNKNOWN_OR_EMPTY, 0, 0, false);
        let (_view, hint) = bounded_http_from_fipc_meta(&m, "v0:empty", None);
        assert!(hint.is_none());
    }

    #[test]
    fn collector_store_single_page_no_retained_no_hint() {
        let m = meta(FIPC_SNAPSHOT_ORIGIN_COLLECTOR_STORE, 1, 1, false);
        let (_view, hint) = bounded_http_from_fipc_meta(&m, "v0:off:1", None);
        assert!(hint.is_none());
    }

    #[test]
    fn truncation_emits_bounded_truncation_only() {
        let m = meta(FIPC_SNAPSHOT_ORIGIN_COLLECTOR_STORE, 2, 5, true);
        let (_view, hint) = bounded_http_from_fipc_meta(&m, "v0:off:2", None);
        let h = hint.expect("truncation must hint");
        assert_eq!(h.reason, RESYNC_HINT_REASON_BOUNDED_TRUNCATION);
        assert_eq!(h.snapshot_cursor, "v0:off:2");
        assert!(h.detail.as_deref().unwrap().contains("available_in_view=5"));
    }

    #[test]
    fn per_rpc_procfs_emits_non_incremental_hint_even_without_truncation() {
        let m = meta(FIPC_SNAPSHOT_ORIGIN_PER_RPC_PROCFS, 1, 1, false);
        let (_view, hint) = bounded_http_from_fipc_meta(&m, "v0:off:1", None);
        let h = hint.expect("per-RPC must hint");
        assert_eq!(h.reason, RESYNC_HINT_REASON_PER_RPC_POLL_NOT_INCREMENTAL);
    }

    #[test]
    fn per_rpc_file_lane_emits_non_incremental_hint() {
        let m = meta(FIPC_SNAPSHOT_ORIGIN_PER_RPC_FILE_LANE, 3, 3, false);
        let (_view, hint) = bounded_http_from_fipc_meta(&m, "v0:off:3", None);
        assert_eq!(
            hint.expect("per-RPC file lane").reason,
            RESYNC_HINT_REASON_PER_RPC_POLL_NOT_INCREMENTAL
        );
    }

    #[test]
    fn retained_store_with_timestamp_emits_tail_replace_hint_not_truncation() {
        let m = meta(FIPC_SNAPSHOT_ORIGIN_COLLECTOR_STORE, 1, 1, false);
        let (_view, hint) = bounded_http_from_fipc_meta(&m, "v0:off:1", Some(1_700_000_000_000));
        let h = hint.expect("retained + ts");
        assert_eq!(h.reason, RESYNC_HINT_REASON_RETAINED_TAIL_REPLACES);
    }
}

//! Bounded snapshot cursor + [`crate::resync::ResyncHint`] mapping (F-03 / F-04 — still provisional).

use glass_collector::ipc::FipcBoundedSnapshotMeta;

use crate::http_types::{BoundedSnapshotContractV0, CURSOR_SEMANTICS_BOUNDED_PREFIX_V0};
use crate::resync::ResyncHint;

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
            reason: "bounded_truncation".to_string(),
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
            reason: "per_rpc_poll_snapshot_not_incremental".to_string(),
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
            reason: "retained_snapshot_tail_replaces_not_append_only".to_string(),
            snapshot_cursor: snapshot_cursor.to_string(),
            detail: Some(
                "retained loop replaces a bounded tail in the collector store each poll; no append-only history"
                    .to_string(),
            ),
        });
    }
    None
}

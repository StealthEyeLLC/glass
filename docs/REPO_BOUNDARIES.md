# Repository boundaries

**Spec §8A.1** — one role per top-level tree; no hidden coupling.

## Ownership

| Component | Owns | Must not own |
|-----------|------|----------------|
| `collector/` | **Raw** observations (`RawObservation`), adapter skeletons, fidelity IPC **types**, self-silence **before** normalization, **thin bridges** (`procfs_session`, **`file_session`**) into session DTOs | Authoritative normalization math for envelopes (owned by `session_engine`), share-safe sanitization, pack bytes as sole owner of export redaction |
| `session_engine/` | Event envelope, session ordering, pack bytes, **pure** sanitization, **procfs** DTO → envelope (`procfs_normalize`), **file-lane** DTO → envelope (`file_lane_normalize`), `SessionLog::append_*_dtos` | UI, network transport, collection |
| `graph_engine/` | Derived graph structures from events | Telemetry collection, rendering |
| `bridge/` | Local loopback HTTP/WebSocket (`glass_bridge`) + optional **F-IPC client** to collector dev TCP; resync **types**; **no** collector-owned state inside bridge (snapshots are whatever the collector returns over F-IPC — seeded store, per-RPC procfs `--procfs-session`, and/or **retained** `--procfs-retained-session` bounded store updates) | Privileged collection, WebGPU, fake live streams |
| `tools/glass-pack` | Pack ZIP validate/info; calls `session_engine` read/validate APIs | Collector telemetry, sanitization implementation, viewer UI |
| `viewer/` | Operator UI, static replay shell | Authoritative session/event truth |
| `schema/` | Canonical JSON Schema + migration notes | Rust/TS type implementations (those live next to consumers until codegen) |

## Schema changes

1. Edit `schema/glass_event_schema.json` + `schema/migrations/` (document new `kind` strings; v0 schema keeps `kind` as open string).
2. Update `session_engine::validate::KNOWN_EVENT_KINDS_V0` and `viewer/src/pack/types.ts` `KNOWN_EVENT_KINDS_V0` in lockstep.
3. Update `session_engine::event::NormalizedEventEnvelope` alignment.
4. Run Rust + viewer + fixture tests; update `schema/examples/` if needed.

## Sanitization

- Lives in `session_engine::sanitization` as a **pure** transform (testable without collector).
- Collector **does not** apply share-safe sanitization on the hot path (plan: export/CLI only).

## Raw vs normalized

- **`glass_collector::raw::RawObservation`** — pre-normalization host facts; may contain secrets.
- **`session_engine::NormalizedEventEnvelope`** — canonical normalized shape for session/pack/graph.
- **Procfs path (v0):** `session_engine::procfs_normalize` maps procfs-shaped DTOs into envelopes (`process_poll_sample`, `process_seen_in_poll_gap`, `process_absent_in_poll_gap`). The collector exposes `procfs_session::ingest_procfs_raw_to_session_log` (self-silence → DTO → `SessionLog::append_procfs_dtos`).
- **File-lane path (v0):** `session_engine::file_lane_normalize` maps directory-poll DTOs into **`file_poll_snapshot`**, **`file_changed_between_polls`**, **`file_absent_in_poll_gap`**, **`file_seen_in_poll_gap`** (distinct from spec `file_read` / `file_write` / `file_create` syscall-class kinds). Collector: `file_session::ingest_file_lane_raw_to_session_log` → `SessionLog::append_file_lane_dtos`. **No** dedicated share-safe export helper in this pass (paths may still need F-05 review before export).
- **Share-safe export (procfs-oriented):** `materialize_share_safe_procfs_pack_bytes` + `glass-collector export-procfs-pack` — not applied on raw ingest. Type separation is still tested in `collector/tests/raw_vs_normalized_boundary.rs`.

## Static vs live

- `viewer` build shipped as static pages is **replay-only** (`getBuildMode()` returns `static_replay`).
- Live WebSocket client will be a separate code path when `bridge` server exists; do not pretend live data exists in the static build.

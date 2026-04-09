# Repository boundaries

**Spec §8A.1** — one role per top-level tree; no hidden coupling.

## Ownership

| Component | Owns | Must not own |
|-----------|------|----------------|
| `collector/` | **Raw** observations (`RawObservation`), adapter skeletons, fidelity IPC **types**, self-silence **before** normalization, **thin bridge** (`procfs_session`) into session DTOs | Authoritative normalization math for envelopes (owned by `session_engine`), share-safe sanitization, pack bytes as sole owner of export redaction |
| `session_engine/` | Event envelope, session ordering, pack bytes, **pure** sanitization, **procfs** `RawObservation` DTO → `NormalizedEventEnvelope` mapping (`procfs_normalize`) | UI, network transport, collection |
| `graph_engine/` | Derived graph structures from events | Telemetry collection, rendering |
| `bridge/` | Local API contracts (types/docs now; server later) | Privileged collection, WebGPU |
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
- **Procfs path (v0):** `session_engine::procfs_normalize` maps procfs-shaped DTOs into envelopes (`process_poll_sample`, `process_seen_in_poll_gap`, `process_absent_in_poll_gap`). The collector exposes `procfs_session::ingest_procfs_raw_to_session_log` (self-silence → DTO → `SessionLog::append_procfs_dtos`). Other adapters remain unnormalized here. Type separation is still tested in `collector/tests/raw_vs_normalized_boundary.rs`.

## Static vs live

- `viewer` build shipped as static pages is **replay-only** (`getBuildMode()` returns `static_replay`).
- Live WebSocket client will be a separate code path when `bridge` server exists; do not pretend live data exists in the static build.

# Phase 0 freeze history

Use this file as historical design/control context, not the current product contract. For the shipped bounded showcase, start with `README.md`, `VISION.md`, `docs/README.md`, and `docs/IMPLEMENTATION_STATUS.md`.

## What this archive replaces

- `docs/PHASE0_FREEZE_TRACKER.md`
- `docs/F03_F04_FREEZE_PROPOSAL.md`
- `docs/F03_LIVE_BACKLOG_FREEZE_PROPOSAL.md`

## Current historical outcome

| Area | Historical result | Where to look now |
|------|-------------------|-------------------|
| `F-03` | Live WebSocket stays a bounded per-connection path with coalescing and explicit resync escalation. It does not claim durable global history. | `bridge/src/live_session_ws.rs`, `docs/contracts/live_session_ws_session_delta_v0.md` |
| `F-04` | Bounded HTTP snapshot stays on opaque cursors plus `bounded_snapshot.snapshot_origin` and fixed `resync_hint.reason` tokens. | `bridge/src/http_types.rs`, `docs/contracts/bridge_session_snapshot_bounded_v0.schema.json` |
| `F-IPC` | Transport remains provisional dev TCP in this repo; Unix-socket/peer-cred freeze is deferred. | `docs/DEMO_RETAINED_SNAPSHOT.md`, `docs/long-horizon/GLASS_V0_BUILD_PLAN.md` |
| `F-05` | Sanitization path/socket policy remains provisional and intentionally narrow. | `session_engine/src/sanitization.rs`, `docs/SANITIZATION_TRUST_CRITERIA.md` |

## Archive rules

- Treat this as rationale/history, not launch copy.
- Prefer the current code, fixtures, and contracts over older proposal language if they diverge.
- Keep new contributor-facing docs out of this file unless they are genuinely historical.

## F-01 — Visual regression method

**Status:** historical open item. The repo keeps `docs/VISUAL_REGRESSION_POLICY.md` as the standing note, but no new launch claim depends on a frozen golden-scene regime.

**Decision package that was left open:**

- Pixel diff with tolerance was the preferred default for first golden scenes.
- CI runner/GPU variance was explicitly deferred until the viewer/render path needed larger golden coverage.

## F-02 — `events.seg` v1

**Status:** provisional v1 landed for Rust/tooling.

**Historical decision:**

- `events.seg` uses `GLSSG001` + version `1` + length-prefixed UTF-8 JSON records.
- The Tier B viewer remains replay-first on bounded packs; `events.seg` does not widen the public product claim by itself.

**Relevant surfaces:** `session_engine/src/events_seg.rs`, `session_engine/src/pack.rs`, `tools/glass-pack`, `docs/long-horizon/GLASS_V0_BUILD_PLAN.md`

## F-03 — Live WebSocket backlog and resync

**Status:** v0 landed as a bounded live path, with historical rationale merged here.

**Historical freeze result:**

- Queue ownership stayed **per connection**, not shared across viewers or sessions.
- Routine pressure uses **coalescing toward the latest bounded snapshot view** instead of pretending every intermediate state was delivered.
- Overflow or continuity loss escalates to **`session_resync_required`** rather than silent continuity claims.
- WebSocket `LIVE_WS_REASON_*` strings remain **separate** from HTTP `RESYNC_HINT_REASON_*`.

**Client inference rule that survived the proposals:**

- `session_snapshot_replaced` means bounded replacement, not append-only history.
- `session_resync_required` means the live WS path gave up continuity for that escalation class and the client must reseed from HTTP.
- `session_delta` is additive and only honest for bounded `collector_store` tails when the bounded fingerprint is unchanged and the tail continuity watermark still matches.

**Still deferred beyond this historical freeze:**

- Durable push ingest
- Cross-session/shared outbound scheduling
- A stronger transport-level continuity contract
- Any interpretation that turns the current WS path into global history

## F-04 — Bounded HTTP snapshot cursor and resync

**Status:** bounded-era F-04 is historically closed.

**Historical freeze result:**

- `snapshot_cursor` stays an **opaque string** for the bounded era.
- The bounded-era cursor family stayed `v0:empty`, `v0:off:0`, and `v0:off:N`.
- `bounded_snapshot.snapshot_origin` is the required disambiguation when `v0:empty` could mean either unknown session or an empty per-RPC poll.
- `resync_hint.reason` stayed on frozen string tokens:
  - `bounded_truncation`
  - `per_rpc_poll_snapshot_not_incremental`
  - `retained_snapshot_tail_replaces_not_append_only`
- Missing `resync_hint` means **no extra bounded warning**, not stronger live continuity.

**Still deferred beyond bounded-era F-04:**

- Live-era HTTP `resync_hint` extensions
- Cursor shapes that encode durable byte/sequence offsets
- Any transport freeze for collector-to-bridge IPC

## F-05 — Sanitization socket/path policy

**Status:** open and intentionally narrow.

**Historical posture that remains relevant:**

- Share-safe export stays an export-lane transform, not a hot-path collector mutation.
- File/path/socket redaction rules are provisional and should not be marketed as a generic secret scanner.
- Any tightening here must preserve causal usefulness and stay aligned with `docs/SANITIZATION_TRUST_CRITERIA.md`.

## F-06 — Golden CI runners

**Status:** historical open item.

The repo kept the question of software vs pinned GPU runners separate from the bounded showcase launch surface. Golden-scene expansion was treated as proof tooling, not front-door positioning.

## F-07 — JSONL line and pack size bounds

**Status:** provisional bounds are explicit in code.

**Historical freeze result:**

- `PROVISIONAL_MAX_JSONL_LINE_BYTES` = 4 MiB
- `PROVISIONAL_MAX_SEG_RECORD_BYTES` = same as JSONL line cap
- `PROVISIONAL_MAX_PACK_FILE_BYTES` = 256 MiB

These remain defensive implementation bounds, not a claim that large-pack streaming is solved in the browser.

## Provisional constants still traced from code

| Symbol | Historical meaning |
|--------|--------------------|
| `PROVISIONAL_BACKLOG_EVENT_THRESHOLD` | Future-facing backlog hint; separate from the frozen bounded HTTP contract |
| `F03_V0_LIVE_WS_QUEUE_MAX_EVENTS` / `F03_V0_LIVE_WS_QUEUE_MAX_BYTES` | v0 per-connection WebSocket queue caps |
| `PROVISIONAL_IPC_AUTH_TOKEN_VERSION` | Collector/bridge auth version while F-IPC transport is still provisional |
| `PROVISIONAL_FIPC_CONNECT_ATTEMPT_MAX` | Caps TCP connect time inside the bridge's per-RPC timeout budget |

## Deliverables that came out of this phase

- `docs/SANITIZATION_TRUST_CRITERIA.md`
- `docs/VISUAL_REGRESSION_POLICY.md`
- `docs/contracts/bridge_session_snapshot_bounded_v0.schema.json`
- `docs/contracts/live_session_ws_skeleton_v1.md`
- `docs/contracts/live_session_ws_session_delta_v0.md`

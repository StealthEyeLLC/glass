# Glass Vertical Slice v0

**Id:** `glass.vertical_slice.v0` (documentation and viewer copy only — not a wire identifier).

## What it is

A single **bounded** demo path through the real Glass v0 substrate: **Tier B static replay** (default) and **`?live=1`** live session use the **same** Scene System v0 strip and Drawable Primitives semantics. The slice is optimized for one coherent story: **honest operator visibility** (replace / append / resync wire roles, HTTP reconcile chip, bounded tail density) — **not** a process graph, **not** full history, **not** invented topology.

## Scenario label

**“Agent expectations vs honest bounds”** is a **demo nickname** only: it stands in for the common failure mode where operators expect more continuity than bounded telemetry can support. It does **not** add a new collector lane, narrative events, or graph edges.

## What is real

- **Replay:** index-ordered prefix vs pack from `.glass_pack`; `compileReplayToGlassSceneV0`; Canvas 2D via `renderLiveVisualOnCanvas`.
- **Live:** bounded WebSocket tail + optional **F-04** HTTP snapshot; `compileLiveToGlassSceneV0`; same primitives path; hybrid WebGPU + Canvas text overlay when available.
- **Frozen contracts unchanged:** opaque `snapshot_cursor`, `bounded_snapshot.snapshot_origin`, `RESYNC_HINT_REASON_*`, F-03 queue/backpressure, `session_delta` only when honestly supportable.

## What remains bounded / not claimed

- No durable global history in the viewer; WS + HTTP are **replacement-style** samples per existing contracts.
- F-IPC transport remains **provisional** (not frozen here).
- Phase-6 topology/runtime scene is **out of scope** for this slice.

## How to run the demo

1. **Replay (default):** build or serve the viewer; open the app (static bundle is replay-only). Drop or open a `.glass_pack`; use transport controls and scrub — the **Scene v0** canvas sits above the scrubber in the layout.
2. **Live:** append **`?live=1`**; connect to a loopback bridge with token + session id as documented in `README.md` and `docs/IMPLEMENTATION_STATUS.md`.

## Next major step

Durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md` “Next engineering steps”.

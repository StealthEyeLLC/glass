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

## Known-good fixture path (replay)

**One** committed pack is the canonical Vertical Slice v0 demo input:

| Path | Description |
|------|-------------|
| `tests/fixtures/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack` | Tier B **`glass.pack.v0.scaffold`**, 3 synthetic `process_poll_sample` events, session id **`glass_vertical_slice_v0`**. |

- **Synthetic:** labeled in event `attrs` / adapter — not collector truth; used for deterministic load + Scene v0 honesty checks.
- **Proves:** `loadGlassPack(…, strict_kinds)` succeeds; `compileReplayToGlassSceneV0` reports index-prefix sample, “not live tail” / “not process topology”, bounded counts — see `viewer/src/replay/verticalSliceFixture.integration.test.ts`.
- **Does not prove:** bridge, WS, HTTP snapshot, F-IPC, retained loops, or any live path.

**Run in the viewer:** `cd viewer && npm run dev` → open the app → **Open file** → select `tests/fixtures/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack` (from a checkout at repo root). Scrub/step — Scene v0 canvas shows prefix depth and R/A/Rz semantics.

**Regenerate bytes** (if the fixture shape changes intentionally): `cd viewer && npm run fixture:vertical-slice`

**Verify with Rust validator:** `cd viewer && npm run verify:vertical-slice-fixture` (or `cargo run -p glass-pack -- validate …` from repo root — see `tests/fixtures/vertical_slice_v0/README.md`).

## How to run the demo (general)

1. **Replay (default):** same as above; the fixture is optional but is the **documented** known-good pack.
2. **Live:** append **`?live=1`**; connect to a loopback bridge with token + session id as documented in `README.md` and `docs/IMPLEMENTATION_STATUS.md`.

## Next major step

Durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md` “Next engineering steps”.

# Glass Vertical Slice v0 / v1 / v2

**Id:** `glass.vertical_slice.v0` (documentation and viewer copy only — not a wire identifier). **Vertical Slice v1** added a richer bounded scene; **v2** adds **bounded actor/sample clusters** from real event kinds only — still **no** wire contract changes.

## Vertical Slice v2 (bounded actor clusters)

**What it adds (viewer-only):**

- **`GlassSceneV0.clusters`:** a **small** (≤4) ordered list of **`SceneActorCluster`** entries: **system** (warning / resync / HTTP reconcile when present), **process** / **file** sample counts from **`kind`** in the bounded live tail or replay prefix only, **snapshot origin** (live, when known), **replay index prefix** (replay, when pack loaded). **Empty tail** / **idle replay** uses an honest **`empty_sample`** lane — not a fake graph.
- **Derivation:** `deriveLiveBoundedActorClusters` / `deriveReplayBoundedActorClusters` in `viewer/src/scene/boundedActorClusters.ts` — counts `process_*`, `command_exec`, `env_access` vs `file_*`; **no** parent/child tree, **no** edges, **no** history outside the current sample.
- **Drawable Primitives v0:** **`actor_cluster_strip_*`**, per-lane **`actor_cluster_segment_*`**, shared **`actor_cluster_emphasis_bar`**, and **`LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT`** (strip under the v1 state rail). **WebGPU** draws the same fills + stroke expansion as Canvas; **cluster text summary** (`clusters: …`) is Canvas overlay only.
- **Default canvas height** for the strip is **200px** CSS (state rail + actor strip + text).

**What it does *not* imply:** process tree, syscall-complete file graph, or full execution history — only **bounded kind tallies** and **current** system/snapshot/replay facts.

## Vertical Slice v1 (scene richness)

**What it adds (viewer-only):**

- **Scene System v0:** clearer **zone** grouping (wire mode, bounded tail density, R/A/Rz slots, snapshot origin, reconcile/resync, **state rail**). **Fact cards** surface only **current** strings (`snapshot_origin`, `resync_reason`, `warning_code`, replay-specific snapshot disclaimer) — **no** graph edges, **no** process tree, **no** invented history.
- **`GlassSceneV0`:** `snapshotOriginLabel` (live: WS `session_snapshot_replaced` or optional last **HTTP** `bounded_snapshot.snapshot_origin` when passed into `compileLiveToGlassSceneV0`); `replayPrefixFraction` (replay only: prefix length / pack size, or `null` when no split yet). **`stripSource`** on `LiveVisualSpec` drives Drawable state-rail geometry (**live** = three lanes: snapshot / resync / warning emphasis; **replay** = honest **prefix vs remainder** lanes or a single remainder fill when unloaded).
- **Drawable Primitives v0:** **`state_rail_*`** and **`replay_*`** semantic tags plus **`LIVE_VISUAL_STATE_RAIL_LAYOUT`**; Canvas 2D and WebGPU still share **`sceneToDrawablePrimitives`**. **WebGPU** does not render text; labels remain on the Canvas overlay (mode, snapshot origin or replay prefix %, wire, HTTP reconcile, honesty).
- **Default canvas height** was raised for v2; see **Vertical Slice v2** (currently **200px** CSS for rail + cluster strip + text).

**What it does *not* imply:** full Glass topology, durable history, or continuity beyond existing bounded contracts. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime scene.

## What it is

A single **bounded** demo path through the real Glass v0 substrate: **Tier B static replay** (default) and **`?live=1`** live session use the **same** Scene System v0 strip and Drawable Primitives semantics. The slice is optimized for one coherent story: **honest operator visibility** (replace / append / resync wire roles, HTTP reconcile chip, bounded tail density, **snapshot origin and system-state rail**) — **not** a process graph, **not** full history, **not** invented topology.

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

**Run in the viewer (manual):** `cd viewer && npm run dev` → **Open file** → select `tests/fixtures/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack` from your checkout. Scrub/step — Scene v0 canvas shows prefix depth and R/A/Rz semantics.

**Dev-only instant load (`npm run dev` only):** open e.g. `http://localhost:5173/?fixture=vertical_slice_v0` (Vite default port). The dev server serves the committed pack at `GET /__glass__/dev/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack` (middleware in `viewer/vite.config.ts`); the replay shell fetches it once, then removes `fixture=` from the URL via `history.replaceState`. **Not available** in `vite build` / static `dist/` (`import.meta.env.DEV === false` — no auto-fetch). **`vite preview`** does not register this middleware — use `npm run dev` for the shortcut. **Vitest** sets `process.env.VITEST` — the replay shell does not auto-fetch fixtures in tests so `import.meta.env.DEV` in the test bundle does not imply a second code path.

**Regenerate bytes** (if the fixture shape changes intentionally): `cd viewer && npm run fixture:vertical-slice`

**Verify with Rust validator:** `cd viewer && npm run verify:vertical-slice-fixture` (or `cargo run -p glass-pack -- validate …` from repo root — see `tests/fixtures/vertical_slice_v0/README.md`).

## How to run the demo (general)

1. **Replay (default):** same as above; the fixture is optional but is the **documented** known-good pack.
2. **Live:** append **`?live=1`**; connect to a loopback bridge with token + session id as documented in `README.md` and `docs/IMPLEMENTATION_STATUS.md`.

## Next major step

Durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md` “Next engineering steps”.

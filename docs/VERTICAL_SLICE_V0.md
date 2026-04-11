# Glass Vertical Slice v0 / v1 / v2 / v3 / v4 / v5 / v6 / v7 / v8 / v9 / v10 / v11 / v12

**Id:** `glass.vertical_slice.v0` (documentation and viewer copy only — not a wire identifier). **Vertical Slice v1** added a richer bounded scene; **v2** adds **bounded actor/sample clusters** from real event kinds only; **v3** adds **bounded regions** (membership + compositional drawable layers); **v4** adds **bounded scene emphasis** and **pulse/flash overlays** driven only by real basis changes between compiles; **v5** adds **bounded scene selection** and **inspector coupling** (same ids + hit map for replay and live); **v6** adds **bounded focus mode** — selection reshapes **dim/emphasis** and overlay/provenance copy from **grouping-only** scene facts; **v7** adds **bounded focus reflow** — the same selection **re-allocates vertical space** and (when applicable) **lane width fractions** for the primary band, state rail, and actor cluster strip; **v8** adds **bounded compare mode** — honest **current vs immediately prior** bounded frame; **v9** adds **bounded evidence drilldown** — a small, inspectable list of **real** tail/prefix rows and facts behind the current selection and compare; **v10** adds **bounded cross-linking** — the same **`glass.sel.v0:*`** selection drives scene, inspector, compare line, and evidence rows when honestly mappable; **v11** adds a **bounded temporal lens** — a small **viewer-held** ring of recent bounded paints plus (replay) **step chips** near the scrub cursor so compare baseline can be the **immediate prior paint** or an **older paint still in the ring** — still **no** wire contract changes; **v12** adds **bounded episodes** — rule-based, **evidence-backed** cards (≤4) from **`computeBoundedSceneCompare`** hints + scene facts + **immediate prior paint** (replay cursor delta) + optional **WS tail mutation** (live) — **not** AI, **not** causal topology, **not** full history.

## Vertical Slice v12 (bounded episodes)

**What it adds (viewer-only):**

- **`boundedEpisodes.ts`:** **`computeBoundedSceneEpisodes`** → **`BoundedSceneEpisodesV0`** (`glass.episodes.v0`) — pure, deterministic; kinds include **resync / warning / reconcile / wire / tail replace·append·shift**, **replay cursor step** (immediate prior vs current **only**), **replay prefix fraction**, **selection / cluster / focus**, **settle**, and **insufficient_history** when compare has no baseline. **`boundedEpisodeEvidenceUiLines`** — evidence panel copy for a selected episode. **`boundedEpisodeSelectionStillValid`** — stale episode id cleared on recompute.
- **`boundedEpisodesPanel.ts`:** **`renderBoundedEpisodesInto`** — compact **card strip** (`data-testid` `*-bounded-episodes-root` / `*-bounded-episode-card`); primary card highlighted; click toggles selection; **suggested** `glass.sel.v0:*` ids applied when honestly present on the episode.
- **`boundedEvidencePanel.ts`:** optional **`episodeContextLine`** / **`episodeHonestyNote`** when an episode is selected (bounded wording; calm when no extra selection target).
- **Replay / live shells:** **Bounded episodes (Vertical Slice v12)** block **above** the temporal lens; **compare baseline** flag **`compareBaselineIsImmediatePrior`** separates compare **vs** immediate-paint **replay cursor** episode honesty; live passes **`lastAppliedWire.eventTailMutation`** only as **bounded** append/replace/none hints for tail-shrink honesty strings.

**What it does *not* imply:** narrative theater, **causal** chains, agent intent, **full** session history, or topology. Episodes are **subordinate** to the scene and **bounded** to what compare + scene fields + prior paint already expose. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full Glass topology/runtime system.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v11 (bounded temporal lens)

**What it adds (viewer-only):**

- **`boundedTemporalLens.ts`:** **`pushBoundedTemporalRing`**, **`resolveCompareBaselineFromRing`**, **`clampTemporalBaselineIndex`**, **`computeReplayStepNeighborhood`**, **`formatBoundedSceneTemporalFingerprint`**, **`buildReplayTemporalLensView`**, **`buildLiveTemporalLensView`** — pure, deterministic; ring size capped (**5**) to scenes the viewer **actually painted**; **not** server log replay, **not** full pack history.
- **`boundedTemporalLensPanel.ts`:** **`renderBoundedTemporalLensInto`** — honesty line, optional **step** row (replay), **Recent paints** chips with fingerprints, **Reset compare baseline** when a non-default baseline is selected.
- **Replay (`replayOnlyShell`):** section **`replay-temporal-lens`** — step chips dispatch **`seek_index`**; paint chips set **compare baseline** (`previousScene` for compare + canvas + inspector + evidence); clearing pack / idle / error clears the ring.
- **Live (`liveSessionShell`):** **`live-temporal-lens-root`** — paint ring only; baseline selection matches replay semantics; **Disconnect** clears the ring; **`buildCurrentLiveVisualSpec`** uses the effective compare baseline for provenance/spec consistency.
- **Honesty:** evidence **`previousBoundedSampleCount`** for “changed” rows still uses the **immediate prior paint** (`previousReplayScene` / `previousPaintedLiveScene`), not the selected compare baseline — honest append-style growth semantics.

**What it does *not* imply:** durable session history, causal timelines, full-pack scrubbing from the lens, or continuity guarantees beyond bounded viewer state. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full Glass topology/runtime system.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v10 (bounded cross-linking)

**What it adds (viewer-only):**

- **`boundedSceneCrosslink.ts`:** pure **`resolveEvidenceRowKeyToSelection`**, **`resolveCompareEvidenceCrosslink`**, **`honestBoundedClusterIdFromEvent`**, optional **`resolveSystemIntegrityRegionSelection`** / **`resolveBoundedEvidenceRegionSelection`** — deterministic mapping from **evidence row keys** (live tail index or replay `seq`+`event_id`) to **cluster** selection ids (`cl_process` / `cl_file`) only when the event kind bucket and scene clusters support it; **compare** paragraph maps to the same **overlay** ids as Canvas hit-testing (`compare_selection` → `compare_summary` → `compare_unavailable`). **No** graph edges, **no** invented causality, **no** hidden selection authority.
- **`boundedEvidenceDrilldown.ts`:** each **`BoundedEvidenceRowV0`** carries a **`rowKey`** (`live_tail_event` | `replay_prefix_event` | `none`) for stable cross-link resolution; evidence **compare** line can **append** selection-scoped compare text from **`BoundedSceneCompareV0.selectionCompareLine`** when honestly present.
- **`boundedEvidencePanel.ts`:** optional **`RenderBoundedEvidenceOptions`** — interactive evidence **cards** and **Compare:** line (when linked) call back into shells to **replace** selection (toggle off when the same target is activated again); unmappable rows set a calm **cross-link note** (`data-testid` `replay-bounded-evidence-crosslink-note` / `live-bounded-evidence-crosslink-note`).
- **`boundedSceneSelection.ts`:** **`boundedSelectionIdOverlay`** helper; **fix:** region role for system rail hit-testing uses **`system_integrity_rail`** (matches **`SceneBoundedRegionRole`**).
- **Shells:** **`replayOnlyShell`** / **`liveSessionShell`** — **Bounded evidence (Vertical Slice v10)** heading; wired cross-link handlers + note element.

**What it does *not* imply:** multi-hop navigation, trace graphs, causal chains, topology between events, or a “full” evidence history. Cross-linking is **bounded to kind buckets and layout ids the compilers already exposed**. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full Glass topology/runtime system.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v9 (bounded evidence drilldown)

**What it adds (viewer-only):**

- **`boundedEvidenceDrilldown.ts`:** **`computeBoundedEvidenceDrilldown({ scene, spec, compare, selectedSelectionId, previousBoundedSampleCount, liveEventTail, replay })`** → **`BoundedEvidenceDrilldownV0`** (`glass.evidence.v0`) — pure, deterministic; **live** uses the bounded WS **`eventTail`** (oldest→newest); **replay** uses the **index-ordered pack prefix** through the scrub cursor. Rows carry labels such as **`live_tail`**, **`replay_prefix`**, **`current_step`**, **`changed`** (when compare + append-style growth are honestly known), **`sampled`** (cluster kind filter). **No** causality chain, **no** graph edges, **no** hidden authority beyond Scene v0 + the same tail/prefix the compilers already use.
- **`boundedEvidencePanel.ts`:** **`renderBoundedEvidenceInto`** — product-style cards + facts list (not a JSON wall); debug JSON for the current replay event remains separate.
- **Shells:** **`replayOnlyShell`** / **`liveSessionShell`** — **Bounded evidence (Vertical Slice v9)** block under the bounded inspector; **`data-testid`:** `replay-bounded-evidence` / `live-bounded-evidence`.

**What it does *not* imply:** complete traces, full history, syscall-complete coverage, or topology between events. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime topology scene.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`.

## Vertical Slice v8 (bounded compare)

**What it adds (viewer-only):**

- **`boundedSceneCompare.ts`:** **`computeBoundedSceneCompare(prev, next, { selectedId })`** → **`BoundedSceneCompareV0`** (`glass.compare.v0`) — pure, deterministic; compares only fields present on **`GlassSceneV0`** (wire mode, tail/sample mass, reconcile/resync/warning/replay-prefix strings, cluster lane facts, emphasis steps/region weights, focus captions for the current selection). **No** invented timeline; **no** graph diff.
- **`LiveVisualSpec`:** **`boundedCompareSummaryLine`**, **`boundedCompareDetailLines`**, **`boundedCompareUnavailableReason`**, **`boundedCompareSelectionLine`** — populated from **`liveVisualSpecFromScene(…, { previousScene })`**. First frame on a path shows a calm **unavailable** reason; later frames compare against the **last painted** bounded scene.
- **`applyBoundedCompareOverlaysToPrimitives`** — small **`compare_overlay_*`** fill quads (amber) on wire/density/HTTP chip/state rail/cluster/region/focus hints; **Canvas text** adds **`compare: …`** and optional **`selection compare: …`** lines; **WebGPU** consumes the **same** primitive list (compare cues are geometry-only; full sentences stay on Canvas overlay).
- **Shells:** **`replayOnlyShell`** / **`liveSessionShell`** capture **`previousReplayScene`** / **`previousPaintedLiveScene`** before each compile and pass **`previousScene`** into **`renderLiveVisualOnCanvas`** / **`paintLiveVisualSurface`**; hit-testing uses the same **`previousScene`** so overlay line stacks stay aligned.
- **Inspector:** **`buildBoundedInspectorLines`** includes compare summary + up to eight detail lines; empty selection shows compare when available.

**What it does *not* imply:** multi-step history, graph evolution, syscall-complete diffs, or any “before” state beyond the **single** prior bounded frame the viewer actually held. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime topology scene.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`. Compare stays **one-step** honest.

## Vertical Slice v7 (bounded focus reflow)

**What it adds (viewer-only):**

- **`boundedSceneFocusReflow.ts`:** **`BoundedStripLayoutV0`** (`glass.strip_layout.v0`) + **`computeBoundedStripLayoutFromFocus(scene, focus, selectionId)`** — pure, deterministic; adjusts **primary band height**, **state rail height**, **cluster strip height**, optional **live** three-lane rail fractions (snapshot / resync / warning) when the selection id targets a rail lane, and optional **cluster lane width fractions** when a cluster is focused and **more than one** lane exists. **Not** graph layout; **not** inferred relationships.
- **Drawable Primitives v0** consumes **`stripLayout`** in **`buildBoundedVisualGeometryPrimitives`**, **`appendVerticalSliceStateRail`**, **`appendBoundedActorClusterStrip`**, **`applyBoundedSceneComposition`**, **`applyBoundedEmphasisOverlays`**, and **`applyBoundedSceneFocusToPrimitives`** (focus frames use reflowed geometry). Canvas **text overlay** uses **`stripPrimaryY`**, **`stripContentBottomY`**, and a **`reflow: …`** line from **`boundedStripReflowLine`** on **`LiveVisualSpec`**. WebGPU draws the **same** reflowed primitive stream as Canvas (still **no** GPU text — captions remain on the overlay).
- **Inspector** adds **`Strip reflow (spatial): …`** when reflow copy is present; **live provenance** can merge focus + reflow fragments into the bounded focus summary line.

**What it does *not* imply:** drill-down pages, a second “detail” scene, process tree expansion, or edges you do not already have in Scene v0. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime scene.

**Next major step:** durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md`. Reflow stays bounded to the **current** compile.

## Vertical Slice v6 (bounded focus mode)

**What it adds (viewer-only):**

- **`boundedSceneFocus.ts`:** **`computeBoundedSceneFocus(scene, selectionId)`** → **`BoundedSceneFocusV0`** (`glass.focus.v0`) — pure, deterministic; **only** existing regions, clusters, and selection-id patterns (no graph traversal, no inferred edges). **`dimHexColor`** + **`applyBoundedSceneFocusToPrimitives`** adjust **fill** tints and optional **selection frame** strokes on related bands; non-focused vertical bands are **dimmed**, not removed.
- **`LiveVisualSpec.boundedFocusCaptionLine`** and provenance **`boundedFocusSummary`** — same focus vocabulary on Canvas overlay (`focus: …` line) and **`formatLiveVisualProvenanceStripText`** (` · focus=…` when active).
- **`sceneToDrawablePrimitives(…, { focusedSelectionId })`** and **`liveVisualSpecFromScene(…, focusedSelectionId?)`** — replay and live **share** the path; WebGPU consumes the same primitive list (honest fallback: if a future effect cannot be expressed in WebGPU, keep Canvas overlay as the source of caption text — **no** fake GPU-only topology).
- **Shells:** **`replayOnlyShell`** / **`liveSessionShell`** already drive selection; v6 **refreshes** inspector and scene paint with **focus-aware** spec + primitives.

**What it does *not* imply:** drill-down graph, hidden navigation, edges between processes, or “related” structures beyond **explicit** region membership and **known** cluster/rail/wire roles in Scene v0. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime scene.

## Vertical Slice v5 (bounded selection + inspector)

**What it adds (viewer-only):**

- **Stable selection ids:** `glass.sel.v0:…` strings derived only from **Scene v0** structures and **Drawable Primitives v0** / Canvas overlay layout — **not** a graph node id space, **not** topology navigation.
- **Pure helpers:** `viewer/src/scene/boundedSceneSelection.ts` — **`buildBoundedSelectionHitTargetsForScene`** (geometry from `sceneToDrawablePrimitives` + overlay line rects aligned with `drawLiveVisualTextLabelsIntoContext`), **`hitTestBoundedSelection`** (last-painted / topmost wins), **`buildBoundedInspectorLines`** (bounded facts + honesty line).
- **Shells:** **`replayOnlyShell`** and **`liveSessionShell`** — pointer hit-testing on the scene surface; **toggle** same target to clear; **replace** on a new target; **bounded inspector** `<pre>` (`data-testid="replay-bounded-inspector"` / `live-bounded-inspector`) plus optional dashed **selection outline** on Canvas (full Canvas or hybrid **text overlay**).
- **Replay default unchanged:** Tier B replay remains the default surface; event JSON inspector remains **debug** (not merged into selection authority).

**Selectable targets (non-exhaustive):** bounded **regions** (`composition_*` panels), **wire** band / ticks / HTTP chip, **state rail** lanes, **cluster** segments, **overlay** lines (mode/tail/snapshot/replay/wire/HTTP), **`bounded_scene_frame`**. **Not** included: fake graph nodes/edges, full-history drill-down, or any structure not already in Scene v0.

**What it does *not* imply:** causal graph, process tree navigation, syscall-complete file graph, or continuity beyond existing bounded replay/live contracts. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime scene.

## Vertical Slice v4 (bounded emphasis / transitions)

**What it adds (viewer-only):**

- **`GlassSceneV0.emphasis`:** **`BoundedSceneEmphasisV0`** — pulse steps (`wirePulseStep`, `samplePulseStep`, `resyncFlashStep`, `systemFlashStep`, `replayCursorPulseStep`) that **decay** once per compile when the shell passes **`previousEmphasis`**, and **bump** only when the **emphasis basis** (wire mode, tail length, resync/warning/reconcile strings, replay cursor / phase) **actually changes**. **Not** idle animation; **not** a timeline.
- **`GlassSceneV0.replayCursorIndex` / `replayEventTotal` / `replayPhase`:** replay presentation facts for emphasis (live uses **`replayPhase: "none"`** and null cursor/total).
- **Pure core:** `computeBoundedSceneEmphasis` in `viewer/src/scene/boundedSceneEmphasis.ts` — deterministic, DOM-free, renderer-free.
- **Drawable Primitives v0:** **`applyBoundedEmphasisOverlays`** inserts **`emphasis_*_overlay`** fills **before** the outer composition frame; region panel tints follow **`regionWeight*`** from emphasis. Canvas and WebGPU share the same primitive list; overlay text **`emphasis: …`** comes from **`LiveVisualSpec.boundedEmphasisSummaryLine`** (Canvas overlay only).
- **Shells:** **`replayOnlyShell`** and **`liveSessionShell`** pass **`previousEmphasis`** between paints so replay scrub / live updates can show bounded pulses.

**What it does *not* imply:** historical replay of wire events, causal graph, or decorative motion when nothing changed. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime scene.

## Vertical Slice v3 (bounded relationships / composition)

**What it adds (viewer-only):**

- **`GlassSceneV0.regions`:** three **`SceneBoundedRegion`** entries with **`memberZoneIds`** only (wire + density + markers vs snapshot/reconcile/state rail vs actor clusters — live; replay uses **`z_primary` / `z_density` / `z_playback`** vs **`z_snapshot` / `z_state_rail`** vs **`z_actor`**). **Roles:** `primary_wire_sample`, `system_integrity_rail`, `bounded_sample_evidence`. This is **grouping**, not edges and not a process tree.
- **Builders:** `buildLiveBoundedRegions` / `buildReplayBoundedRegions` in `viewer/src/scene/boundedSceneRegions.ts` — deterministic labels and zone lists from existing zone ids only.
- **Drawable Primitives v0:** **`applyBoundedSceneComposition`** runs after the state rail + cluster strip: underlay **panels** + **left accent bars** aligned to the fixed band / rail / cluster layout, a **1px separator** between system rail and evidence strip, and an **outer bounded-scene frame** stroke. New **`composition_*`** semantic tags (including **`composition_bounded_scene_frame`** + WebGPU edge expansion). Same primitive stream for Canvas and WebGPU.
- **`LiveVisualSpec.boundedCompositionCaption`:** short **`Wire · System · Evidence`** line (from `formatBoundedCompositionCaption`) on the Canvas text overlay — **not** a second semantic authority.

**What it does *not* imply:** causal links between regions, full topology, or history outside the bounded sample. **F-IPC transport** remains **provisional**. This is still **not** the Phase-6 full runtime scene.

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

## Next major step (unchanged)

Durable push ingest and/or additive live-era HTTP/WS fields **without** breaking frozen bounded-era HTTP — see `docs/IMPLEMENTATION_STATUS.md` “Next engineering steps”. Selection, inspector, and **v6 focus** stay bounded to the current compile; they do **not** replace the need for durable ingest or a future honest topology surface when data exists.

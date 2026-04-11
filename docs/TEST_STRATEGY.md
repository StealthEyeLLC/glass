# Test strategy (bootstrap)

**Public doc order (for context):** [README](../README.md) → [VISION.md](../VISION.md) → [VERTICAL_SLICE_V0.md](VERTICAL_SLICE_V0.md) → [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) → this file.

Maps tests to build-plan obligations. **Visual / resync / golden** jobs are scaffolded; behavior grows in Phase 5–7.

## Rust (`cargo test --workspace`)

| Test / crate | Obligation |
|--------------|------------|
| `session_engine` unit | Sanitization invariants |
| `session_engine::tests::pack_roundtrip` | `.glass_pack` JSONL ZIP I/O + seq validation (write path rejects invalid seq) |
| `session_engine::tests::events_seg` | `events.seg` v1 encode/decode, file append, `SessionLog::from_seg_path`, JSONL vs seg pack same events |
| `session_engine::tests::pack_exclusivity` | ZIP must not mix `events.jsonl` + `events.seg`; writer/manifest pairing |
| `session_engine::validate::validate_pack_manifest` | `glass.pack.v0.scaffold` vs `glass.pack.v0.scaffold_seg` rules |
| `session_engine::tests::session_append` | Append ordering |
| `session_engine::tests::schema_roundtrip` | JSON ↔ `NormalizedEventEnvelope` |
| `session_engine::tests::export_manifest` | Sanitization → manifest fields (`share_safe_recommended` stays false until human review) |
| `session_engine::tests::procfs_normalize` | DTO → envelope mapping; strict kinds; `SessionLog::append_procfs_dtos` + strict pack roundtrip |
| `session_engine::tests::file_lane_normalize` | File-lane DTO → `file_poll_snapshot` / poll-gap kinds; rejects bogus raw kinds |
| `session_engine::tests::procfs_share_safe_export` | `materialize_share_safe_procfs_pack_bytes` → strict validate + exe redacted |
| `session_engine::tests::file_lane_share_safe_export` | `materialize_share_safe_file_lane_pack_bytes` → strict validate + provisional path / entity redaction |
| `session_engine::tests::sanitization_fixtures` | Matrix: `procfs_exe_path.json`, **`file_lane_poll_paths.json`**, argv, IP, socket, causality |
| `session_engine::sanitization` (unit) | `redacts_procfs_exe_field`, **`redacts_file_lane_path_fields_provisional`** |
| `glass_collector::tests::export_procfs_share_safe` | Ingest → share-safe bytes → strict reload |
| `glass_collector::tests::export_file_lane_share_safe` | File-lane ingest → **`materialize_share_safe_file_lane_pack_bytes`** → strict reload + no path leaks |
| `session_engine::tests::envelope_validation` | Procfs + **file-lane** normalized kinds accepted in strict set |
| `graph_engine::tests::smoke` | Graph crate consumes session facts |
| `bridge::tests::resync_contract` | Resync constants + recovery enum |
| `bridge::tests::http_contract` | Loopback-only config; `/health` unauthenticated; bearer gate on `/capabilities` + snapshot; `collector_fipc` + **`websocket.live_session_delta_skeleton`** capability flags; bounded `SessionSnapshotResponse` without F-IPC (no `bounded_snapshot` / `max_events_requested`); **503** when F-IPC configured but collector unreachable (**`error`:** `collector_ipc_connection_refused` when the OS fails fast, else `collector_ipc_timeout` with `fipc_phase: tcp_connect` if connect stalls); non-loopback F-IPC rejected; WS bad-request without upgrade; real WS handshake + hello JSON (`live_session_delta_skeleton` when F-IPC configured); `serve_listener` + `tokio-tungstenite` client |
| `bridge::tests::fipc_bridge_errors` | F-IPC **503** JSON classification: auth mismatch (`collector_ipc_auth_mismatch` + `handshake_code`), RPC **timeout** (`collector_ipc_timeout` + `fipc_phase`), malformed handshake line (`collector_ipc_malformed_response`); **`PROVISIONAL_FIPC_CONNECT_ATTEMPT_MAX`** sanity |
| `bridge::tests::ws_live_session` | **`live_session_subscribe`** → `session_hello` (`f03_v0_live_ws`, `session_delta_wire_v0_server` when enabled) + `session_snapshot_replaced` after collector store change; **`session_delta`** with **non-empty `events`** when delta wire is on, **`collector_store`** append extends tail with **stable bounded prefix** (257 → 258 events); **`retained_file_lane_grows_fixture_then_forced_replace_triggers_resync`** — retained prefix grow after subscribe → delta, then **`set_session_events`** → `session_resync_required` (`LIVE_WS_REASON_STORE_REPLACED_SINCE_WATERMARK`); capabilities `live_session_ingest` / `websocket.session_delta_wire_v0`; F-IPC multi-connection harness; frozen HTTP snapshot regression; **many short F-IPC connections → accept in a loop** |
| `glass_bridge::live_session_ws` (unit) | **`F03OutboundQueue`**: OR-threshold; snapshot + **`session_delta`** overflow coalesce to latest snapshot + resync; reason separation vs HTTP; `docs/contracts/live_session_ws_session_delta_v0.md` |
| `bridge::tests::snapshot_fipc` | HTTP snapshot over F-IPC (**bounded F-04 frozen**): **`v0:empty`** disambiguated by **`snapshot_origin`** (unknown vs empty per-RPC procfs); opaque cursor; **`resync_hint`** tokens + optional **`detail`**; truncation / per-RPC / retained tail; known-empty store `v0:off:0`; seeded store without retained **no** hint; **503** / auth unchanged |
| `glass_bridge::snapshot_contract` (unit) | `bounded_http_from_fipc_meta`: no hint for `unknown_or_empty` or full single-page store; truncation / per-RPC / retained + `retained_snapshot_unix_ms` reasons |
| `glass_collector::ipc_dev_tcp` (`snapshot_store_contract_tests`) | `SnapshotStore::get_bounded`: `v0:empty` + `session_known == false` vs `v0:off:0` for known empty vec; prefix cursor; **`try_live_delta_tail_v0`** append-only vs replacement revision |
| `integration_tests::repo_layout` | Monorepo shape; **Vertical Slice v0** `.glass_pack` fixture file present |
| `integration_tests::hvt_policy` | HVT count ≤ cap |
| `integration_tests::golden_scaffold` | Golden harness files exist |
| `integration_tests::tests::retained_snapshot_demo_smoke` | Subprocess: build `glass-collector` + `glass_bridge`, retained `ipc-serve` + fixture, bridge F-IPC client; HTTP GET snapshot asserts `live_session_ingest: false`, `retained_snapshot_unix_ms`, bounded cursors/events; empty raw `[]` honest zero events; retained max-events tail clamp. **CI:** also run as standalone job `Retained snapshot demo smoke (collector ↔ bridge F-IPC)` (`.github/workflows/ci.yml`) for visibility |
| `integration_tests::resync_scaffold` | Bridge dependency from integration layer |
| `glass_collector::tests::raw_and_capability` | Raw JSON round-trip; `ProcessSample` kind serde; default fidelity **Linux:** `FallbackReducedVisibility` + active procfs manifest; **non-Linux:** `NoSensorsActive`; privileged never `HighFidelityPrimary` without eBPF; missing class `atomic_kernel_process_spawn_exit_truth` |
| `glass_collector::tests::raw_vs_normalized_boundary` | `RawObservation` vs `NormalizedEventEnvelope` type separation (`session_engine` dev-dep) |
| `glass_collector::tests::ipc_and_privilege` | IPC auth version, envelope JSON round-trip, privilege context |
| `glass_collector::tests::ipc_fipc_tcp` | Provisional F-IPC TCP: handshake OK, wire/auth/secret mismatch rejections, **`invalid_request_line`** after handshake on garbage NDJSON, bounded snapshot, listener smoke; **per-RPC procfs** JSON fixture: normalized snapshot, request + global caps, per-RPC JSON omits `retained_snapshot_unix_ms`; **per-RPC file-lane** fixture → `file_poll_snapshot`, empty `[]` honest **`v0:empty`** + **`snapshot_meta.snapshot_origin`** (`per_rpc_procfs` / `per_rpc_file_lane`); **procfs + file-lane feeds** same runtime, distinct session ids; **retained procfs** / **retained file-lane** store paths: `retained_snapshot_unix_ms` present when session matches that loop’s meta, wrong-session meta omitted, per-RPC vs retained independent, **procfs retained + file-lane retained metas** independent for different session ids |
| `glass_collector::procfs_retained_loop` (unit) | `retained_procfs_poll_tick`: tail clamp under max, empty raw `[]` updates meta, non-Linux without fixture errors without advancing meta; **prefix extend** keeps **`store_revision`**; **non-prefix** replaces + bumps revision |
| `glass_collector::file_lane_retained_loop` (unit) | `retained_file_lane_poll_tick`: tail clamp under max, empty raw `[]` still updates poll meta (honest stale/empty); **prefix extend** keeps **`store_revision`** |
| `glass_collector::ipc_dev_tcp` (`apply_retained_poll_extended_then_replaced`) | `SnapshotStore::apply_retained_poll_continuity` extend vs replace |
| `glass_collector::tests::self_silence_pipeline` | Suppression before normalization input; counters |
| `glass_collector::tests::adapter_poll_honesty` | eBPF poll `Unsupported`; **Linux:** procfs poll non-empty with `ProcessSample`; **non-Linux:** procfs empty |
| `glass_collector::tests::self_silence_procfs` | Self-silence matches `pid` on `ProcessSample` payloads |
| `glass_collector::tests::procfs_adapter_fixture_linux` | **Linux only:** temp `proc/` tree → samples + second-poll `ProcessSeenInPollGap` |
| `glass_collector::procfs_snapshot` (unit) | `comm` / `status` / `stat` parsers; `sample_records_bounded` fixture dir + truncation |
| `glass_collector::tests::procfs_normalize_e2e` | Ingest → `process_poll_sample` session; strict pack load; self-silence before normalize; non-procfs raw kinds ignored; raw JSON serde roundtrip → ingest |
| `glass_collector::tests::fs_file_lane_adapter` | Tempdir: inactive without `watch_root`; first poll snapshot-only; second poll size change → `FileChangedBetweenPolls`; ingest → `file_poll_snapshot`; fidelity summary when lane configured |

## Viewer (`npm test` in `viewer/`)

| Suite | Obligation |
|-------|------------|
| `src/app/mode.test.ts` | `getBuildMode` stays **`static_replay`**; `uiSurfaceFromSearch` for `?live=1` |
| `src/app/verticalSliceV0.test.ts` | **Vertical Slice v0** copy exports (`VERTICAL_SLICE_V0_ID`, hero subtitles; **v18** flagship session id `canonical_v15_append_heavy`; **v20** reading-order + receipt supplement strings; **v21** **`GLASS_FLAGSHIP_CHAIN_*`** in reading-order strings) |
| `src/app/devFixtureRoute.test.ts` | **`planDevFixtureLoad`**: dev vs production inert (`DEV` flag); **`vertical_slice_v0`** + **`flagship`** (`load_dev_pack`); strip `fixture=` |
| `src/replay/verticalSliceFixture.integration.test.ts` | **`@vitest-environment node`**: committed **`tests/fixtures/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack`** → **`loadGlassPack` strict_kinds** → **`compileReplayToGlassSceneV0`**: honesty line (not live tail / not topology), prefix sample scope, bounded counts, replace→append wire mode |
| `src/replay/canonicalScenariosV15.integration.test.ts` | **Vertical Slice v15** — **`tests/fixtures/canonical_scenarios_v15/*.glass_pack`** load + scene assertions (replace/append/calm compare/file clusters); **live** warning + resync → **`compileLiveToGlassSceneV0`**; regression: minimal **`vertical_slice_v0`** Tier B pack still loads |
| `src/replay/flagshipVerticalSliceV18.integration.test.ts` | **Vertical Slice v18** — flagship **`canonical_v15_append_heavy.glass_pack`**: strict load, session id, **append** at end cursor, bounded tail **14** |
| `src/replay/verticalSliceV19AuditHardening.integration.test.ts` | **Vertical Slice v19** — mounted replay + flagship bytes: **temporal compare baseline** chip click clears bounded **claim** + **episode** selection and **primary-claim** chip highlight (trust handoff); **v21** asserts **empty-receipt supplement** text matches **`RECEIPT_EMPTY_SUPPLEMENT_AFTER_TEMPORAL_BASELINE`** |
| `integration_tests::repo_layout` | **`canonical_scenarios_v15_packs_present`** — four v15 scenario packs committed |
| `src/live/applyLiveSessionMessage.test.ts` | Live wire reducer: `session_hello`, `session_snapshot_replaced` replacement sample, non-empty `session_delta` append, empty delta no-op, `session_resync_required` reconcile counter, `session_warning`; **`lastAppliedWire`** surface (replace / append / none, resync summary, truncated sample honesty) |
| `src/live/liveStatePresentation.test.ts` | `buildLiveStatePresentationDoc` (resync + reconcile trigger, bounded-sample honesty, HTTP snapshot_meta fallback); **`liveConnectDisabledFromPreflight`** (F-IPC not configured vs failed/missing preflight) |
| `src/live/liveVisualModel.test.ts` | **`buildLiveVisualSpec`**: idle / hello / replace / append / **none_delta** / **resync** / **warning** priority; **`stripSource`**, **`snapshotOriginLabel`**, **`httpSnapshotOrigin`** option; **`liveVisualDensity01`** cap; **`LIVE_VISUAL_MODE_FILL`** distinctness; reconcile summary line |
| `src/live/liveVisualMarkers.test.ts` | **`buildLiveVisualMarkersLayout`**: three fixed **slot** ticks (replace / append / resync wire) — **at most one active** from current `LiveVisualSpec.mode`; **HTTP** chip when `reconcileSummary` is set; **no** ticks active for hello / idle / none_delta / warning; deterministic **geometry**; **`liveVisualTickActiveFill`**; **`buildLiveVisualLegendPrimaryRow`** / **`buildLiveVisualLegendHonestyRow`** / **`formatLiveVisualLegendBlock`** / **`liveVisualTickAbbrev`** (legend matches tick semantics; honesty: **not** a timeline) |
| `src/live/liveVisualCanvas.test.ts` | **`renderLiveVisualIntoContext`** with a pure mock 2D context (band + **marker ticks** + optional **HTTP** chip + labels — primitives path); **`renderLiveVisualTextOverlayIntoContext`** (**clearRect** + mode line — hybrid overlay path; optional **selection** highlight + **`previousScene`** for outline parity); **`renderLiveVisualOnCanvas`** integration (**`GlassSceneV0`** from **`compileLiveToGlassSceneV0`**; **`RenderLiveVisualOnCanvasOptions`** `{ layout, selectedSelectionId }`; canvas sized; **`getContext("2d") === null`** returns `false`); Vitest **`viewer/vitest.setup.ts`** stubs **`getContext("2d")`** with minimal mocks (**`clearRect`**, **`fillRect`**, **`save`/`restore`/`setLineDash`** for bounded selection outline — hybrid overlay + full path) so the suite stays quiet |
| `src/live/liveWebGpuProbe.test.ts` | **`hasNavigatorGpu`**, **`initialWebGpuLiveStatus`**, **`formatWebGpuLiveStatusLine`**, **`requestWebGpuAdapter`** / **`requestWebGpuDevice`** failure paths (no `navigator.gpu`, rejected promises) |
| `src/live/liveVisualWebGpu.test.ts` | **`hexToRgba01`**, **`pxRectToTriangleList`** quad size, **`buildLiveVisualWebGpuVertexData`** non-empty interleaved buffer; **`buildDrawablePrimitivesWebGpuVertexData`** matches scene-derived **`sceneToDrawablePrimitives`** for the same layout (manual path includes v6 inactive **focus** pass); tagged stroke expansion **vertex float** count vs manual tally |
| `src/live/liveVisualRenderer.test.ts` | **`paintLiveVisualSurface`**: **`GlassSceneV0`** input; optional **`selection`** (`selectedSelectionId`, **`previousScene`**) forwarded to Canvas/overlay paths; explicit **`compare`** in **`liveVisualSpecFromScene`**; `webGpuBundle === null` → full **Canvas 2D**, WebGPU + text overlay hidden; mocked **`renderLiveVisualWebGpuFrame`**: hybrid when GPU + overlay succeed; GPU frame fails → Canvas-only; GPU OK + overlay **`getContext("2d") === null`** → full Canvas (degraded) |
| `src/live/liveVisualParityV17.test.ts` | **Vertical Slice v17** — **`sceneToDrawablePrimitives`**: compare **`compare_overlay_*`** tags appear with honest **`previousScene`**, absent when baseline missing (primitive-stream parity anchor) |
| `src/live/liveVisualProvenance.test.ts` | **`deriveRendererMode`**, **`buildLiveVisualProvenanceStrip`**, **`formatLiveVisualProvenanceStripText`** (incl. **`boundedFocusSummary`** / ` · focus=…`), **`serializeLiveVisualProvenanceStrip`** / **`toLiveVisualProvenanceExportV0`**: deterministic JSON; hybrid vs canvas_only; credential-field absence; honesty constant |
| `src/scene/glassSceneV0.test.ts` | **`GLASS_SCENE_V0`** kind string |
| `src/scene/compileLiveScene.test.ts` | **`compileLiveToGlassSceneV0`** + **`liveVisualSpecFromScene`** idle path; **Vertical Slice v0** zone labels (wire mode); **Vertical Slice v3** **`regions`** roles |
| `src/scene/compileReplayScene.test.ts` | **`compileReplayToGlassSceneV0`**: idle / append / load error; replay zone label honesty |
| `src/scene/sceneToLiveVisualSpec.test.ts` | Renderer boundary: replay scene → **`LiveVisualSpec`** (**`boundedCompositionCaption`**, **`boundedEmphasisSummaryLine`**, **`boundedFocusCaptionLine`**) |
| `src/scene/drawablePrimitivesV0.test.ts` | **`semanticTag`** on each primitive (**`band_background`**, **`density_band`**, **`tick_slot_*`**, **`http_chip_*`**, **`band_frame`**, **`state_rail_*`** / **`replay_*`**, Vertical Slice v2 **`actor_cluster_*`**); tick slot order; **`expandStrokeRectToFillRects`** edge tags (**`band_frame_*`** / **`http_chip_frame_*`** / **`state_rail_frame_*`** / **`actor_cluster_strip_frame_*`** / **`composition_bounded_scene_frame_*`**) |
| `src/scene/sceneToDrawablePrimitives.test.ts` | **`sceneToDrawablePrimitives`** equals **`buildBoundedVisualGeometryPrimitives` + `appendBoundedActorClusterStrip` + `applyBoundedSceneComposition` + `applyBoundedEmphasisOverlays` + Vertical Slice v6 **`computeBoundedSceneFocus` / `applyBoundedSceneFocusToPrimitives`** + Vertical Slice v8 **`computeBoundedSceneCompare` / `applyBoundedCompareOverlaysToPrimitives`** (no prior frame); explicit **layout** override; replay + **live/replay** shared tag prefix via **`listSemanticTagsForScene`** (incl. **`composition_*`**) |
| `src/scene/boundedSceneFocus.test.ts` | **Vertical Slice v6** — **`dimHexColor`**; **`computeBoundedSceneFocus`** inactive vs region selection (deterministic band + **`provenanceFocusLine`**) |
| `src/scene/boundedSceneFocusReflow.test.ts` | **Vertical Slice v7** — **`defaultBoundedStripLayout`** stack; **`computeBoundedStripLayoutFromFocus`** reflow vs idle; primary vs cluster focus |
| `src/scene/semanticTagSummaryV0.test.ts` | **`listSemanticTagsForPrimitives`** / **`primitiveTagsSummary`**; **`listSemanticTagsForScene`** vs primitive map; live/replay tag prefix (incl. composition); **WebGPU expansion** tag stream vs **`listSemanticTagsForWebGpuPrimitiveExpansion`** (**four** strokes incl. outer frame) |
| `src/scene/boundedActorClusters.test.ts` | **`deriveLiveBoundedActorClusters`** / **`deriveReplayBoundedActorClusters`**, **`countBoundedKindBuckets`**, **`formatActorClusterSummaryLine`** |
| `src/scene/boundedSceneRegions.test.ts` | **`buildLiveBoundedRegions`** / **`buildReplayBoundedRegions`** zone membership; **`formatBoundedCompositionCaption`** |
| `src/scene/boundedSceneSelection.test.ts` | **Vertical Slice v5–v6** — stable **`glass.sel.v0:*`** ids; **`buildBoundedSelectionHitTargetsFromPrimitives`** / **`buildBoundedSelectionHitTargetsForScene`** + **`hitTestBoundedSelection`**; **`unionBoundingRectForSelectionId`**; **`buildBoundedInspectorLines`** (none / region / cluster); **v8** overlay lines incl. compare + strip reflow hit rects; **v17** — **`buildBoundedSelectionHitTargetsForScene`** uses explicit **`compare`** in **`liveVisualSpecFromScene`** (aligned with **`sceneToDrawablePrimitives`**) |
| `src/scene/boundedSceneCompare.test.ts` | **Vertical Slice v8** — **`computeBoundedSceneCompare`** (unavailable / delta / unchanged / selection-scoped cluster); **`applyBoundedCompareOverlaysToPrimitives`**; **`sceneToDrawablePrimitives`** with **`previousScene`** |
| `src/scene/boundedEvidenceDrilldown.test.ts` | **Vertical Slice v9** — **`computeBoundedEvidenceDrilldown`** live tail + replay prefix; selection narrowing; **`changed`** rows vs prior bounded count; empty cluster filter |
| `src/scene/boundedSceneCrosslink.test.ts` | **Vertical Slice v10** — **`honestBoundedClusterIdFromEvent`**, **`resolveEvidenceRowKeyToSelection`** (live + replay), **`resolveCompareEvidenceCrosslink`**, system region, drilldown **`rowKey`** + selection-scoped compare echo |
| `src/scene/boundedTemporalLens.test.ts` | **Vertical Slice v11** — **`pushBoundedTemporalRing`**, **`resolveCompareBaselineFromRing`**, **`clampTemporalBaselineIndex`**, **`computeReplayStepNeighborhood`**, replay/live lens views |
| `src/scene/boundedEpisodes.test.ts` | **Vertical Slice v12** — **`computeBoundedSceneEpisodes`**, **`boundedEpisodeEvidenceUiLines`**, **`boundedEpisodeSelectionStillValid`**, replay cursor + baseline honesty, **`renderBoundedEpisodesInto`** smoke |
| `src/scene/boundedClaims.test.ts` | **Vertical Slice v13–v16** — **`computeBoundedSceneClaims`**, **`resolvePrimaryClaimId`** (episode + cluster), append/replace status, **`buildBoundedClaimReceipt`** (**`glass.receipt.v0`**, ref keys, weakness), **`boundedClaimEvidenceUiLines`**, receipt DOM (**`data-trust-tier`**, **`data-section`**, empty copy, limitation node); **v19** — **`formatBoundedClaimChipStatusShort`**; **v20** — empty receipt **`emptySupplementLine`** |
| `src/scene/boundedEvidencePanel.test.ts` | **Vertical Slice v16** — **`boundedEvidenceRowLabelCaption`**, trust root **`data-testid`**, claim-support row markup + caption text |
| `src/scene/boundedSceneEmphasis.test.ts` | **`computeBoundedSceneEmphasis`** pulse/decay; replay cursor transition; **`emphasis_*`** overlay tags when pulse steps **> 0** |
| `src/scene/semanticTagSummaryGoldens.test.ts` | **`exportTagSummaryToJsonLines`** format; **`@vitest-environment node`**: fixture **`__fixtures__/semantic_tag_summary_live_idle_v0.jsonl`** vs live idle **`listSemanticTagsForScene`** export (includes **`actor_cluster_*`**) |
| `src/live/liveSessionLog.test.ts` | **`appendLiveSessionLogLine`** eviction + timestamps; **`formatLiveSessionLogHuman`**; **`serializeLiveSessionLogForExport`** shape; **`summarizeLiveWireForLog`** (concise, no event payloads); **`truncateForLog`** |
| `src/live/liveWsSessionStatus.test.ts` | Pure **`resolveCloseInitiator`**, **`formatLastCloseLine`**, **`buildWsStatusJson`**, phase lines |
| `src/live/liveSessionShell.test.ts` | **`live-vs-hero`**; **`live-flagship-framing`** (v22: **`GLASS_FLAGSHIP_CHAIN_DOC`** parity with replay); **`live-reading-order`** (v20); mounted shell: **Disconnect** + **live-ws-status** + **live-session-log** + **live-visual-surface** / **canvas** / **live-visual-canvas-webgpu** / **live-visual-canvas-text-overlay** / **live-visual-gpu-status** / **fallback** / **live-visual-legend** / **live-visual-provenance-copy-json** / **live-visual-provenance-copy-text** test ids; **mock WebSocket**: operator close records **code** + **operator_disconnect**; **reconnect** clears prior close in JSON; **mock `navigator.clipboard`**: provenance **Copy JSON** success/failure → **session log** |
| `src/live/liveSessionHttp.test.ts` | `bridgeHttpToLiveWsUrl` maps http→ws / https→wss + `access_token` |
| `src/live/liveCapabilities.test.ts` | `parseBridgeCapabilitiesJson` + `fetchBridgeCapabilities` error/ok paths (fetch mock) |
| `src/live/liveSessionStorage.test.ts` | sessionStorage round-trip for URL/session/delta-wire; **no** token key; `saveLiveBridgeUrl` partial |
| `src/live/liveHttpReconcile.test.ts` | `makeReconcileRecord` operator vs `session_resync_required` |
| `replayModel.test.ts` | Pure replay reducer: load lifecycle, play/pause/tick, seek/step, empty pack, entity selection |
| `staticReplay.test.ts` | Mounted shell: **`replay-vs-hero`**, **`replay-flagship-framing`** (v21), **`replay-reading-order`**, metadata + sanitized summary, **Scene v0** canvas (`data-scene`), timeline/inspector binding, play timer (fake), scrub, errors, empty pack; **`?fixture=vertical_slice_v0`** does not call **`fetch`** (`replayOnlyShell` **`devFixtureEnvForReplay()`** treats **`process.env.VITEST`** as non-dev — Vitest otherwise leaves **`import.meta.env.DEV` true**; mirrors production **`dist/`** inertness) |
| `tierBReplay.integration.test.ts` | ZIP → `loadGlassPack` → `reduceReplay` (Node env / `fflate`); JSONL + **`scaffold_seg` / `events.seg`** (sanitized summary, **`process_poll_sample`** strict_kinds); empty JSONL |
| `loadPack.test.ts` | `.glass_pack` validation mirrors Rust (`pack` exclusivity + manifest rules); JSONL + **seg** loads; mixed ZIP rejection; malformed seg; empty seg header-only; **`@vitest-environment node`** — jsdom VM can break `fflate` `zipSync`; real browser unaffected |
| `eventsSeg.test.ts` | Raw `events.seg` v1 decode: magic/version, truncated header/prefix/payload, zero-length record, bad JSON/UTF-8; roundtrip with `encodeEventsSegV1` (test helper) |

## Tools

| Tool | Obligation |
|------|------------|
| `glass-pack validate` / `info` | Pack validation; `info` / `info --json` prints sanitization markers + `artifact_lane_hint`; **`--strict-kinds`**; **`--expect-share-safe`** / **`--expect-raw-dev`** |
| `glass-pack` `tests/cli_smoke.rs` | Subprocess: share-safe + raw-dev expectations, strict JSON validate, `info --json` |
| `glass-pack` unit tests (in `main.rs`) | Share-safe vs raw bytes + incomplete sanitized manifest |
| `session_engine::tests::pack_manifest_expectations` | `validate_share_safe_export_manifest` / `validate_raw_dev_pack_manifest` / `pack_artifact_lane_hint` |
| `glass-collector capabilities` | JSON `FidelityReport` (procfs active summary on Linux when enabled; **fs_file_lane** inactive unless a watch root is configured on the adapter instance — default stack has no root) |
| `glass-collector sample-procfs` | Linux: bounded JSON array of `RawObservation` (`--twice` optional); non-Linux: `[]` + stderr |
| `glass-collector sample-file-lane` | Bounded JSON `RawObservation[]` from `--watch-root` (`--twice` optional second poll for gap semantics) |
| `glass-collector normalize-procfs` | **Unsanitized** dev pack: `--output out.glass_pack` and/or `--events-json-stdout`; Linux poll or `--from-raw-json` |
| `glass-collector normalize-file-lane` | Same as normalize-procfs for **file-lane** events (`--watch-root` + optional `--from-raw-json`) |
| `glass-collector export-procfs-pack` | **Share-safe** pack: `--output share.glass_pack` (required); same poll / `--from-raw-json` as normalize; Tier B–compatible after sanitize |
| `glass-collector export-file-lane-pack` | **Provisional share-safe** file-lane pack: `--output` + `--watch-root` (or `--from-raw-json`); **`sanitize_default.1.provisional`**; F-05 path rules **not** final — operator review |
| `glass-collector ipc-serve` | Loopback TCP F-IPC (provisional); optional seed session; **`--procfs-session`** = per-RPC procfs repoll; **`--file-lane-session`** + **`--file-lane-watch-root`** or **`--file-lane-from-raw-json`** = per-RPC file-lane (directory-poll semantics); **`--procfs-retained-session`** + interval / max-events = bounded retained procfs `SnapshotStore`; **`--file-lane-retained-session`** + **`--file-lane-retained-interval-ms`** / **`--file-lane-retained-max-events`** + same file-lane root/fixture inputs as per-RPC = bounded retained file-lane store; **pairwise distinct** session ids across all four modes (reject on collision); **`live_session_ingest` stays false** — no WS deltas |
| `scripts/retained_snapshot_demo/*` | Operator demo: fixture-backed retained collector + bridge + curl/IRM snapshot (`docs/DEMO_RETAINED_SNAPSHOT.md`) |
| `viewer` `KNOWN_EVENT_KINDS_V0` | Must match Rust strict set (procfs + **file-lane** poll kinds for Tier B `strict_kinds` loads) |

## CI jobs

See `.github/workflows/ci.yml`: rust, viewer, sanitization (Rust tests), HVT, golden placeholder, bootstrap.

## Future (not yet required to pass)

- Browser e2e for resync (tab throttle, WS drop) — Phase 5–6
- Golden image diff — Phase 6
- Headless `glass capture` E2E — Phase 8

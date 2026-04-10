# Test strategy (bootstrap)

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
| `session_engine::tests::sanitization_fixtures` | Fixture matrix + causality |
| `session_engine::tests::export_manifest` | Sanitization → manifest fields (`share_safe_recommended` stays false until human review) |
| `session_engine::tests::procfs_normalize` | DTO → envelope mapping; strict kinds; `SessionLog::append_procfs_dtos` + strict pack roundtrip |
| `session_engine::tests::procfs_share_safe_export` | `materialize_share_safe_procfs_pack_bytes` → strict validate + exe redacted |
| `session_engine::tests::sanitization_fixtures` | Includes `procfs_exe_path.json` matrix |
| `session_engine::sanitization` (unit) | `redacts_procfs_exe_field` |
| `glass_collector::tests::export_procfs_share_safe` | Ingest → share-safe bytes → strict reload |
| `session_engine::tests::envelope_validation` | Procfs normalized kinds accepted in strict set |
| `graph_engine::tests::smoke` | Graph crate consumes session facts |
| `bridge::tests::resync_contract` | Resync constants + recovery enum |
| `integration_tests::repo_layout` | Monorepo shape |
| `integration_tests::hvt_policy` | HVT count ≤ cap |
| `integration_tests::golden_scaffold` | Golden harness files exist |
| `integration_tests::resync_scaffold` | Bridge dependency from integration layer |
| `glass_collector::tests::raw_and_capability` | Raw JSON round-trip; `ProcessSample` kind serde; default fidelity **Linux:** `FallbackReducedVisibility` + active procfs manifest; **non-Linux:** `NoSensorsActive`; privileged never `HighFidelityPrimary` without eBPF; missing class `atomic_kernel_process_spawn_exit_truth` |
| `glass_collector::tests::raw_vs_normalized_boundary` | `RawObservation` vs `NormalizedEventEnvelope` type separation (`session_engine` dev-dep) |
| `glass_collector::tests::ipc_and_privilege` | IPC auth version, envelope JSON round-trip, privilege context |
| `glass_collector::tests::self_silence_pipeline` | Suppression before normalization input; counters |
| `glass_collector::tests::adapter_poll_honesty` | eBPF poll `Unsupported`; **Linux:** procfs poll non-empty with `ProcessSample`; **non-Linux:** procfs empty |
| `glass_collector::tests::self_silence_procfs` | Self-silence matches `pid` on `ProcessSample` payloads |
| `glass_collector::tests::procfs_adapter_fixture_linux` | **Linux only:** temp `proc/` tree → samples + second-poll `ProcessSeenInPollGap` |
| `glass_collector::procfs_snapshot` (unit) | `comm` / `status` / `stat` parsers; `sample_records_bounded` fixture dir + truncation |
| `glass_collector::tests::procfs_normalize_e2e` | Ingest → `process_poll_sample` session; strict pack load; self-silence before normalize; non-procfs raw kinds ignored; raw JSON serde roundtrip → ingest |

## Viewer (`npm test` in `viewer/`)

| Suite | Obligation |
|-------|------------|
| `replayModel.test.ts` | Pure replay reducer: load lifecycle, play/pause/tick, seek/step, empty pack, entity selection |
| `staticReplay.test.ts` | Mounted shell: metadata + sanitized summary, timeline/inspector binding, play timer (fake), scrub, errors, empty pack |
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
| `glass-collector capabilities` | JSON `FidelityReport` (procfs active summary on Linux when enabled) |
| `glass-collector sample-procfs` | Linux: bounded JSON array of `RawObservation` (`--twice` optional); non-Linux: `[]` + stderr |
| `glass-collector normalize-procfs` | **Unsanitized** dev pack: `--output out.glass_pack` and/or `--events-json-stdout`; Linux poll or `--from-raw-json` |
| `glass-collector export-procfs-pack` | **Share-safe** pack: `--output share.glass_pack` (required); same poll / `--from-raw-json` as normalize; Tier B–compatible after sanitize |
| `viewer` `KNOWN_EVENT_KINDS_V0` | Must match Rust strict set (procfs kinds added for Tier B `strict_kinds` loads) |

## CI jobs

See `.github/workflows/ci.yml`: rust, viewer, sanitization (Rust tests), HVT, golden placeholder, bootstrap.

## Future (not yet required to pass)

- Browser e2e for resync (tab throttle, WS drop) — Phase 5–6
- Golden image diff — Phase 6
- Headless `glass capture` E2E — Phase 8

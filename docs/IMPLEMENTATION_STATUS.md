# Implementation status

**Spec:** `GLASS_FULL_ENGINEERING_SPEC_v10.md` (locked)  
**Plan:** `GLASS_V0_BUILD_PLAN.md`

## Present in repo (bootstrap complete)

| Area | State |
|------|--------|
| Workspace | Root `Cargo.toml` workspace + `viewer/` npm package |
| Phase 1 spine | `session_engine`: events, manifest, ZIP **`glass.pack.v0.scaffold`** (JSONL, Tier B viewer) + **`glass.pack.v0.scaffold_seg`** (`events.seg` binary v1: magic `GLSSG001` + length-prefixed JSON), standalone `.seg` file I/O (`SessionLog::from_seg_path` / `write_seg_path`), append session log, **pure** `sanitization` (export path only) |
| Schema | `schema/glass_event_schema.json`, `schema/examples/minimal_event.json`; TS codegen not wired |
| Phase 7 | `viewer/`: Tier B **static replay** — read-only `.glass_pack` (`loadGlassPack`), **replay session state** (`replayModel`: play/pause, seek/scrub, step, timeline + inspector), drag/drop + file open, sanitized/redaction summary surface; **index-ordered** playback (optional `ts_ns` display only; not wall-clock sync) |
| Collector | **`glass_collector` library**: raw `RawObservation`, adapters (`procfs_process` on Linux), `procfs_session` bridge → `session_engine::ProcfsRawObservationDto` + `ingest_procfs_raw_to_session_log` (self-silence then append), `FidelityReport`, `pipeline`, IPC **types**, privilege context. **`glass-collector` binary**: `capabilities`; **`sample-procfs`** → raw JSON; **`normalize-procfs`** → poll (Linux) or **`--from-raw-json`** → normalize → **`--output` `.glass_pack`** or **`--events-json-stdout`** (no live loop; no eBPF) |
| Session / normalization | **`session_engine::procfs_normalize`**: honest mapping to kinds `process_poll_sample`, `process_seen_in_poll_gap`, `process_absent_in_poll_gap` (not `process_start` / `process_end`). **Identity:** `entity_id` `procfs_pid:{pid}` + optional `;st:{ticks}` + comm hint; `resolution_quality` `linux_pid_ephemeral_procfs_poll`; attrs carry **pid reuse** warning. **`SessionLog::append_procfs_dtos`**, `SessionManifest::procfs_poll_dev_scaffold` for dev packs |
| Bridge | `glass_bridge::resync` types + **provisional** threshold constant |
| Graph | `graph_engine` minimal counting helper over events |
| HVT | `collector/config/hvt_rules.toml` (5 patterns) + CI count test |
| Tests | See `docs/TEST_STRATEGY.md` |
| CI | `.github/workflows/ci.yml` |

## Intentionally scaffolded / deferred

- **Viewer** loading of `glass.pack.v0.scaffold_seg` / raw `events.seg` (Tier B remains JSONL-only until viewer work).
- Segment compression, mmap session store, replay indexes (beyond v1 record format).
- Real eBPF attach, fs notify, netlink (**non-procfs adapters remain capability-only / empty polls**)
- **Not in procfs lane:** kernel-exact spawn/exit, guaranteed parent/child temporal truth, namespace/container boundaries (deferred to eBPF / future work)
- Non-procfs raw → normalized mapping (eBPF, fs, network lanes deferred)
- Bridge HTTP/WebSocket server (Phase 5)
- WebGPU renderer (Phase 6)
- Stricter browser-side limits (size caps, streaming JSONL) beyond current ZIP + line-length bound (F-07); no live WebGPU path

## Blocked on human decisions

See `docs/PHASE0_FREEZE_TRACKER.md` — Open freeze decisions.

## Next engineering steps

1. Close remaining Phase 0 items (golden method F-01, resync numbers F-03/F-04, sanitization policy F-05).
2. **Optional:** teach Tier B viewer to accept `glass.pack.v0.scaffold_seg` (parse `events.seg` v1 in TS) + align F-07 pack file cap in browser.
3. Extend normalization for additional adapters; IPC socket when F-IPC closes; optional **export sanitization** CLI hook for procfs dev packs.
4. WebGPU scene replay (Phase 6) — separate track.

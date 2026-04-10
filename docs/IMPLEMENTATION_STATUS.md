# Implementation status

**Spec:** `GLASS_FULL_ENGINEERING_SPEC_v10.md` (locked)  
**Plan:** `GLASS_V0_BUILD_PLAN.md`

## Present in repo (bootstrap complete)

| Area | State |
|------|--------|
| Workspace | Root `Cargo.toml` workspace + `viewer/` npm package |
| Phase 1 spine | `session_engine`: events, manifest, ZIP **`glass.pack.v0.scaffold`** (JSONL, Tier B viewer) + **`glass.pack.v0.scaffold_seg`** (`events.seg` binary v1: magic `GLSSG001` + length-prefixed JSON), standalone `.seg` file I/O (`SessionLog::from_seg_path` / `write_seg_path`), append session log, **pure** `sanitization` (export path only) |
| Schema | `schema/glass_event_schema.json`, `schema/examples/minimal_event.json`; TS codegen not wired |
| Phase 7 | `viewer/`: Tier B **static replay** — read-only `.glass_pack` (`loadGlassPack`) for **`glass.pack.v0.scaffold`** (`events.jsonl`) and **`glass.pack.v0.scaffold_seg`** (`events.seg` v1: magic `GLSSG001` + length-prefixed UTF-8 JSON per record, same envelope as JSONL); **replay session state** (`replayModel`: play/pause, seek/scrub, step, timeline + inspector), drag/drop + file open, sanitized/redaction summary surface; **index-ordered** playback (optional `ts_ns` display only; not wall-clock sync) |
| Collector | **`glass_collector` library**: raw `RawObservation`, adapters (`procfs_process` on Linux; **`fs_file_lane`** = bounded **directory poll** under optional `watch_root`, inactive when root unset), `procfs_session` + `ingest_procfs_raw_to_session_log`, **`file_session`** + `ingest_file_lane_raw_to_session_log` / `load_file_lane_observations_for_cli`, `procfs_ipc_feed` + **`file_lane_ipc_feed`** (per-RPC procfs / **file-lane** fixture or live tree → normalized JSON for F-IPC), **`procfs_retained_loop`** (optional background poll → **bounded tail** in `SnapshotStore`; `retained_procfs_poll_tick` for deterministic tests), `RetainedPollMeta` + optional F-IPC `retained_snapshot_unix_ms`, `FidelityReport`, `pipeline`, IPC **types** + **provisional dev TCP** F-IPC (`ipc_dev_tcp`, `SnapshotStore`, `IpcDevTcpRuntime`, NDJSON `FipcBridgeToCollector` / `FipcCollectorToBridge`), privilege context. **`glass-collector` binary**: `capabilities`; **`sample-procfs`**; **`sample-file-lane`** (live tree under `--watch-root`); **`normalize-procfs`**; **`normalize-file-lane`** → **unsanitized** dev `.glass_pack` (or `--events-json-stdout`; `--from-raw-json` supported); **`export-procfs-pack`** → share-safe pack; **`ipc-serve`** → loopback TCP F-IPC (bounded snapshot RPC; seed JSON; **`--procfs-session`** = per-request procfs repoll; **`--file-lane-session`** + **`--file-lane-watch-root`** or **`--file-lane-from-raw-json`** = per-request file-lane poll/fixture; **`--procfs-retained-session`** + interval + max-events = **retained** procfs store — **distinct** session ids vs procfs/file-lane per-RPC modes; **`live_session_ingest` stays false**) |
| Session / normalization / export | **`procfs_normalize`** → polling-honest process kinds. **`file_lane_normalize`** → directory-poll file kinds (`file_poll_snapshot`, `file_changed_between_polls`, `file_absent_in_poll_gap`, `file_seen_in_poll_gap`) — **not** `file_read` / `file_write` syscall truth. **`materialize_share_safe_procfs_pack_bytes`**: `sanitize_events_for_share` + `apply_sanitization_to_manifest` + `write_glass_pack_to_vec` (procfs-oriented; **no** dedicated share-safe path for file-lane-only packs in this pass). **`attrs.exe`** on export: full string replaced with **`[REDACTED_ABS_PATH]`** (procfs path leakage). Ingest / normalize CLI output stays **unsanitized** |
| Bridge | `glass_bridge::resync` types + **provisional** threshold constant; **`glass_bridge` binary** — loopback HTTP (`127.0.0.1:9781` default) + WS handshake-only; optional **`--collector-ipc-endpoint` / `--collector-ipc-secret`** (loopback TCP) so `GET /sessions/:id/snapshot` fetches **bounded** events from `glass-collector ipc-serve` (`collector_ipc` metadata on success; **503** `collector_ipc_unavailable` if TCP/handshake/RPC fails). Snapshots may reflect per-RPC procfs (`--procfs-session`), per-RPC **file-lane** (`--file-lane-session` on collector), **retained** procfs store (`--procfs-retained-session`), or seeded `SnapshotStore`. HTTP JSON unchanged except event payloads. **`retained_snapshot_unix_ms`** applies only to retained procfs session id. **`live_session_ingest`** remains **false** (no WS delta stream) |
| Graph | `graph_engine` minimal counting helper over events |
| HVT | `collector/config/hvt_rules.toml` (5 patterns) + CI count test |
| `tools/glass-pack` | **`glass-pack validate`** / **`info`** on `.glass_pack`; **`--strict-kinds`** (alias `--strict`); **`--expect-share-safe`** / **`--expect-raw-dev`** for manifest lane checks; **`--json`**. Rules implemented in `session_engine::pack` (`validate_share_safe_export_manifest`, `validate_raw_dev_pack_manifest`, `pack_artifact_lane_hint`) |
| Tests | See `docs/TEST_STRATEGY.md` |
| Retained snapshot demo | `docs/DEMO_RETAINED_SNAPSHOT.md`; `scripts/retained_snapshot_demo/` (fixture JSON + `demo.ps1` / `demo.sh`); subprocess smoke `integration_tests/tests/retained_snapshot_demo_smoke.rs`; **CI:** dedicated GitHub Actions job `Retained snapshot demo smoke (collector ↔ bridge F-IPC)` in `.github/workflows/ci.yml` |
| CI | `.github/workflows/ci.yml` |

## Intentionally scaffolded / deferred

- **Viewer `events.seg` does not imply:** compression, mmap/streaming session store, larger-than-F-07 browser caps beyond current decode, or any live ingest path.
- Segment compression, mmap session store, replay indexes (beyond v1 record format).
- Real eBPF attach, **fanotify/inotify-class live streams**, netlink (**`network_lane` / `linux_ebpf` remain capability-only or unsupported polls**)
- **Not in procfs lane:** kernel-exact spawn/exit, guaranteed parent/child temporal truth, namespace/container boundaries (deferred to eBPF / future work)
- Non-procfs raw → normalized mapping (**eBPF, network** lanes deferred). **Fs file lane** raw → normalized is **landed** for directory-poll semantics only (see `file_lane_normalize`).
- Bridge **live ingest**: WS delta stream, resync fault-injection harness, incremental cursor semantics beyond provisional `v0:off:n` / `v0:empty` (retained procfs loop still **replaces** a bounded tail per tick — **not** a guaranteed append-only live timeline or delta stream)
- WebGPU renderer (Phase 6)
- Stricter browser-side limits (size caps, streaming JSONL) beyond current ZIP + line-length bound (F-07); no live WebGPU path

## Blocked on human decisions

See `docs/PHASE0_FREEZE_TRACKER.md` — Open freeze decisions.

## Next engineering steps

1. Close remaining Phase 0 items (golden method F-01, resync numbers F-03/F-04, sanitization policy F-05).
2. **Optional:** tighten browser-side pack/ZIP size caps and streaming decode if large packs become a product requirement (F-07 line/record bound already enforced per event).
3. **Optional next file-lane step:** `notify`/`fanotify` substrate (still honest capability gating), F-IPC bounded snapshots for file-lane sessions, and/or **share-safe export** rules for file paths in `attrs` (F-05). Extend normalization + share-safe export for **eBPF / network** when those adapters land; IPC socket when F-IPC closes; tighten F-05 / path heuristics with human review; optional **`glass-pack`** checks for additional pack lanes when they land.
4. Replace **provisional TCP** F-IPC with human-frozen transport (Unix socket / peer creds); honest WS deltas + resync harness (drops/dupes/reorder); live viewer client (Phase 5–6); WebGPU scene replay (Phase 6) — separate track.

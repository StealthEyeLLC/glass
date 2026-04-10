# Phase 0 freeze tracker

Program control document — **not** the product spec. See `GLASS_FULL_ENGINEERING_SPEC_v10.md` for normative requirements.

For each item: **status**, **proposed default** (when applicable), **rationale**, **code/tests that depend on it**, **provisional OK for Phase 1?**

---

## Closed for Phase 1 scaffold path (still revisit when F-02 lands)

| ID | Topic | Status | Proposed default | Rationale | Code / tests | Provisional OK? |
|----|--------|--------|------------------|-----------|--------------|-----------------|
| P-SCAFFOLD | Pack format `glass.pack.v0.scaffold` | **Closed for P1 / Tier B** | ZIP + `manifest.json` + `events.jsonl` only | Default export + static viewer | `session_engine::pack::write_glass_pack_to_vec`, `read_glass_pack_*`, viewer `loadPack.ts` | Yes — primary interchange |
| P-SCAFFOLD-SEG | Pack format `glass.pack.v0.scaffold_seg` | **Implemented (Rust/tooling)** | Same ZIP + `events.seg` binary payload | Same validation rules as JSONL; **not** loaded by current Tier B viewer | `write_glass_pack_scaffold_seg_to_vec`, `read_glass_pack_bytes_level`, `tests/events_seg.rs`, `tests/pack_exclusivity.rs` | Yes — opt-in pack variant |

---

## F-02 — `events.seg` v1 (length-prefixed JSON records) — **implemented (provisional)**

| Field | Content |
|-------|---------|
| **Status** | **Provisional landed** — first real binary path in `session_engine::events_seg`. Human still owns compression, mmap, and on-disk session policy for collector scale. |
| **Chosen v1 layout** | **Magic (8 B ASCII)** `GLSSG001` + **`u32` LE format version `1`** + repeat **`u32` LE payload length** + **UTF-8 JSON** per `NormalizedEventEnvelope` (`session_engine::event`). Max record bytes = F-07 / `PROVISIONAL_MAX_JSONL_LINE_BYTES` parity. |
| **Decision-ready options not taken (yet)** | (B) fixed non-JSON binary payload; (C) zstd-compressed frames — deferred. |
| **Proposed default** | Keep v1 for Phase 1–2 internal/session files and `glass.pack.v0.scaffold_seg`; revisit when collector volume demands. |
| **Rationale** | Debuggable, serde-compatible, same event JSON as JSONL scaffold; honest migration story (decode → same `Vec<Event>` as JSONL). |
| **Compatibility** | **Tier B:** still `glass.pack.v0.scaffold` + JSONL. **Rust:** `read_glass_pack` accepts `glass.pack.v0.scaffold_seg` + `events.seg`. **ZIP exclusivity:** JSONL scaffold packs **must not** include `events.seg`; seg packs **must not** include `events.jsonl`. |
| **Code / tests** | `session_engine/src/events_seg.rs`, `session_engine::SessionLog::from_seg_path`, `write_seg_path`, `materialize_pack_scaffold_seg`, `tests/events_seg.rs`, `tests/pack_exclusivity.rs` |
| **Provisional OK?** | **Yes** — viewer unchanged until explicitly extended. |

---

## Provisional constants in code (traced here)

| Symbol | Value | Location | Until |
|--------|-------|----------|-------|
| `SANITIZE_PROFILE_VERSION` | `sanitize_default.0.provisional` | `session_engine::sanitization` | Human signs off default share-safe rules (F-05) |
| `PROVISIONAL_BACKLOG_EVENT_THRESHOLD` | `10_000` | `glass_bridge::resync` | F-03 |
| `PROVISIONAL_MAX_JSONL_LINE_BYTES` | `4 * 1024 * 1024` | `session_engine::validate` | F-07 |
| `PROVISIONAL_MAX_SEG_RECORD_BYTES` | same as JSONL line (alias) | `session_engine::events_seg` | F-07 |
| `PROVISIONAL_MAX_PACK_FILE_BYTES` | `256 * 1024 * 1024` | `session_engine::validate` | F-07 — whole `.glass_pack` read cap (non-streaming) |
| `PROVISIONAL_IPC_AUTH_TOKEN_VERSION` | `0` | `glass_collector::ipc` | Collector ↔ bridge local IPC auth version until transport freeze |
| `PROVISIONAL_MAX_PROC_ENTRIES_SCANNED` | `16_384` | `glass_collector::procfs_snapshot` | Cap on numeric `/proc` entries read per poll — human may raise for large hosts |
| `PROVISIONAL_MAX_PROCFS_OBSERVATIONS_PER_POLL` | `1024` | `glass_collector::procfs_snapshot` | Hard cap on raw observations (samples + deltas) per `poll_raw` |
| `PROVISIONAL_MAX_PROCFS_DELTA_PER_DIRECTION` | `64` | `glass_collector::adapters::procfs_process` | Cap on `ProcessSeenInPollGap` / `ProcessAbsentInPollGap` rows per poll |
| `PROVISIONAL_MAX_FS_FILE_OBSERVATIONS_PER_POLL` | `1024` | `glass_collector::adapters::fs_file_lane` | Cap on raw observations (samples + deltas) per `poll_raw` |
| `PROVISIONAL_MAX_FS_DELTA_PER_DIRECTION` | `64` | `glass_collector::adapters::fs_file_lane` | Cap on created/missing/changed rows per poll direction |
| `PROVISIONAL_MAX_FS_SCAN_PATHS_FOR_STATE` | `4096` | `glass_collector::adapters::fs_file_lane` | Max paths stored between polls for gap comparison (sample emission may be lower) |
| `PROVISIONAL_DEFAULT_FS_MAX_DEPTH` | `8` | `glass_collector::adapters::fs_file_lane` | Default max recursion depth under declared watch root |
| `PROVISIONAL_MAX_RETAINED_SNAPSHOT_EVENTS` | `2048` | `glass_collector::procfs_retained_loop` | Max normalized events kept in `SnapshotStore` per retained session after each poll (tail) |
| Sanitization regex / socket heuristic | IPv4 private ranges, `.local`/`.internal`/`.corp`, `.sock` + `/var/run` paths | `session_engine::sanitization` | F-05 |

---

## Procfs → normalized identity (v0 landed — human may tighten)

| Topic | Status | Notes |
|-------|--------|--------|
| Process `entity_id` | **Provisional** | Prefix `procfs_pid:` + optional `;st:{starttime_kernel_ticks}` + short comm hint; **not** a stable cross-session UUID. |
| `resolution_quality` | **Fixed string v0** | `linux_pid_ephemeral_procfs_poll` — documents PID reuse and poll-only visibility. |
| Normalized `kind` names | **Frozen for procfs v0** | `process_poll_sample`, `process_seen_in_poll_gap`, `process_absent_in_poll_gap` — distinct from `process_start` / `process_end`. |
| Share export `attrs.exe` | **Provisional** | Entire non-empty `exe` string replaced with `[REDACTED_ABS_PATH]` on `sanitize_events_for_share` — not basename-preserving; human may tune for operator UX (F-05). |
| `glass-pack --expect-share-safe` | **Provisional** | Checks manifest fields aligned with `export-procfs-pack`; does not prove content safety or non-leakage beyond current sanitization profile. |
| Human-owned | Open | Namespace-aware identity, cgroup/container correlation, eBPF-correlated stable IDs — deferred. |

---

## Directory poll file lane (v0 landed — human may tighten)

| Topic | Status | Notes |
|-------|--------|-------|
| Substrate | **Polling** | Recursive directory scan under a **declared** `watch_root`; symlink **directories** are not descended (bounded root). |
| Raw kinds | **Landed** | `FileSeenInPollSnapshot`, `FileChangedBetweenPolls`, `FileMissingInPollGap`, `FileCreatedInPollGap` + `RawSourceQuality::DirectoryPollDerived`. |
| Normalized `kind` names | **Landed v0** | `file_poll_snapshot`, `file_changed_between_polls`, `file_absent_in_poll_gap`, `file_seen_in_poll_gap` — **not** syscall-level `file_read` / `file_write` / `file_create` / `file_delete`. |
| File `entity_id` | **Provisional** | Prefix `fs_poll_rel:` + sanitized relative path string; **not** stable inode identity. |
| `resolution_quality` | **Fixed string v0** | `declared_root_relative_path_directory_poll_not_kernel_inode_identity`. |
| Default adapter stack | **Inactive file lane** | `FsFileLaneAdapter::default()` has **no** `watch_root` → `implementation_active: false` until an operator configures a root (CLI `sample-file-lane` / tests construct `with_watch_root`). |
| Gap semantics when state budget truncates | **Explicit** | Payload `state_budget_truncated` when scan hits `PROVISIONAL_MAX_FS_SCAN_PATHS_FOR_STATE` — poll-gap deltas may be incomplete. |
| Human-owned | Open | fanotify/inotify live semantics, rename atomicity, share-safe path redaction for file `attrs` (F-05), F-IPC file-lane snapshots. |

---

## Open — human-owned vs decision-ready

### F-01 — Visual regression method

| Field | Content |
|-------|---------|
| **Status** | Open |
| **Decision-ready options** | (A) PNG pixel diff + per-channel tolerance in CI; (B) perceptual hash (aHash/pHash) with Hamming threshold |
| **Proposed default** | **(A)** for first golden scenes — easier to debug; document GPU tolerance |
| **Rationale** | Phase 6 needs a frozen policy before baselines accumulate |
| **Depends on** | None for Phase 1 |
| **Code / tests** | `tools/golden_scenes/` (placeholder only) |
| **Provisional OK?** | **Yes** — no Phase 1 blocker |

### F-03 — Resync backlog threshold

| Field | Content |
|-------|---------|
| **Status** | Open |
| **Decision-ready options** | Event count ceiling, byte ceiling of queued deltas, or both (AND) |
| **Proposed default** | Keep `10_000` events **or** add `4 MiB` bytes — **human picks** |
| **Rationale** | Viewer recovery contract (spec §18A.3) needs numeric tests |
| **Code / tests** | `glass_bridge::resync::PROVISIONAL_BACKLOG_EVENT_THRESHOLD`; also exposed in `GET /capabilities` JSON (`bridge_api_version` 1 skeleton) — **byte ceiling** still unset |
| **Provisional OK?** | **Yes** — threshold numeric is still human-owned (F-03); server skeleton does not implement queued deltas |

### F-IPC — Collector ↔ bridge local IPC (credentials + path)

| Field | Content |
|-------|---------|
| **Status** | Open — **provisional dev TCP** landed; **final transport unfrozen** |
| **Decision-ready options** | Unix socket path under XDG_RUNTIME_DIR vs fixed `/run/glass/…`; SO_PEERCRED vs shared secret file; challenge nonce length; replace NDJSON/TCP when frozen |
| **Proposed default** | Abstract or path Unix socket + versioned envelope (`PROVISIONAL_IPC_AUTH_TOKEN_VERSION`) + peer cred check where available |
| **Rationale** | Privilege separation (§10.3B / §18.4) requires a frozen contract before production bridge |
| **Code / tests** | `glass_collector::ipc` (`FipcBridgeToCollector`, `FipcCollectorToBridge`, `PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION`), `glass_collector::ipc_dev_tcp`, `glass_collector::procfs_ipc_feed`, `glass_collector::procfs_retained_loop`, `collector/tests/ipc_fipc_tcp.rs`, `glass_bridge` `ipc_client` + `bridge/tests/snapshot_fipc.rs`, `docs/PRIVILEGE_SEPARATION.md` |
| **Provisional OK?** | **Yes** — TCP loopback is **explicitly dev/skeleton**; Unix socket + credential story still human-owned |

### F-04 — `resync_hint` JSON wire shape

| Field | Content |
|-------|---------|
| **Status** | Open |
| **Decision-ready options** | Extend `ResyncHint` with `reason` enum + `snapshot_cursor` opaque string vs structured `{ seq, byte_offset }` |
| **Proposed default** | Opaque cursor string + `reason: "backlog" \| "ipc_gap"` |
| **Rationale** | Bridge + viewer must agree before Phase 5 |
| **Code / tests** | `glass_bridge::resync::ResyncHint` (stub); `SessionSnapshotResponse.resync_hint` field present (always `null` until ingest + hint semantics freeze) |
| **Bounded snapshot cursor (related, not resync_hint)** | F-IPC `BoundedSnapshotReply.snapshot_cursor` remains **`v0:off:{n}`** (events returned after caps) or **`v0:empty`**. **`--procfs-session`**: re-poll each RPC. **`--procfs-retained-session`**: F-IPC reads `SnapshotStore`; each loop tick **replaces** the session row with a bounded **tail** of the latest normalized poll (not append-only deltas). Optional **`retained_snapshot_unix_ms`** (also on bridge HTTP JSON) is last successful retained tick wall time — **provisional**, not a freshness contract. Human still owns incremental cursor / resync for live ingest. |
| **Provisional OK?** | **Yes** — WS delta + hint payloads not wired |

### F-05 — Sanitization socket / path policy

| Field | Content |
|-------|---------|
| **Status** | Open — rules are **heuristic** |
| **Decision-ready options** | Freeze explicit suffix list vs path-prefix list; document **non-coverage** |
| **Proposed default** | Keep current heuristic; publish “not a complete secret scanner” in pack README |
| **Rationale** | Spec §30.2 honesty — must not over-claim |
| **Code / tests** | `session_engine::sanitization`, `tests/fixtures/sanitization/` |
| **Provisional OK?** | **Yes** — profile id remains `.provisional` |

### F-06 — Golden CI runners

| Field | Content |
|-------|---------|
| **Status** | Open |
| **Decision-ready options** | Pin `ubuntu-latest` + software WebGPU vs self-hosted GPU label |
| **Proposed default** | Start with **software** SwiftShader/ANGLE where available; document skips |
| **Rationale** | Flaky baselines hurt trust |
| **Code / tests** | future `tools/golden_scenes/capture.mjs` |
| **Provisional OK?** | **Yes** |

### F-07 — JSONL line / pack size DoS bounds

| Field | Content |
|-------|---------|
| **Status** | **Provisional closed** — values explicit in code |
| **Proposed default** | Per-line / per-record: `PROVISIONAL_MAX_JSONL_LINE_BYTES` = 4 MiB; segment records share the same cap; whole pack read: `PROVISIONAL_MAX_PACK_FILE_BYTES` = 256 MiB (until streaming read). |
| **Rationale** | CLI + tools read full ZIP into memory today; cap limits hostile inputs. |
| **Code / tests** | `session_engine::pack`, `session_engine::events_seg`, `viewer/src/pack/loadPack.ts` (line cap only — viewer has no pack file size cap yet) |
| **Provisional OK?** | **Yes** — revisit with streaming + security review |

---

## Deliverables checklist

- [x] `docs/SANITIZATION_TRUST_CRITERIA.md` — sign-off process
- [x] `docs/VISUAL_REGRESSION_POLICY.md` — pending F-01 choice
- [x] F-02 v1 format documented **in this tracker** (ADR-equivalent for bootstrap)

---

## Trace: provisional → tracker

When adding or changing a provisional constant, **update this file** and the symbol’s doc comment (`/// **Provisional:** see docs/PHASE0_FREEZE_TRACKER.md F-XX`).

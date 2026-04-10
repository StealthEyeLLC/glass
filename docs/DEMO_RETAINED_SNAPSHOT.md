# Demo: retained procfs snapshot → bridge (bounded HTTP)

This walkthrough proves the **retained snapshot seam** end-to-end: `glass-collector ipc-serve` runs an optional background procfs (or **fixture**) poll loop that fills a bounded in-memory `SnapshotStore`; `glass_bridge` reads snapshots over **provisional TCP loopback F-IPC** with a **separate** HTTP bearer token.

## What this proves

- Retained mode + deterministic **`RawObservation[]` JSON** works on **any OS** (no `/proc` required for the default demo).
- `GET /sessions/:id/snapshot` returns **real** normalized JSON, **bounded** cursors (`v0:…`), and optional **`retained_snapshot_unix_ms`** when the collector last refreshed retained data for that session.
- **`live_session_ingest` is `false`** — there is **no** WebSocket delta stream and no claim of live ingest.

## What stays provisional

- **F-IPC transport** is still **TCP loopback** (dev skeleton), not a human-frozen Unix socket / peer-cred path (`docs/PHASE0_FREEZE_TRACKER.md`).
- **`snapshot_cursor`** and **`retained_snapshot_unix_ms`** are **telemetry / opaque v0 strings**, not a finalized resync contract (F-04 still open).
- Retained loop **replaces** a bounded **tail** of events each tick — not an append-only live timeline.

## Fixture

Checked-in fixture (stable session id `demo_retained_sess`):

`scripts/retained_snapshot_demo/raw_observations_demo.json`

## One-command demo (preferred)

From the **repository root**, after a normal Rust build:

**Windows (PowerShell)**

```powershell
Set-Location X:\Glass   # your clone
powershell -ExecutionPolicy Bypass -File scripts/retained_snapshot_demo/demo.ps1
```

**Unix (bash)**

```bash
cd /path/to/glass
bash scripts/retained_snapshot_demo/demo.sh
```

The scripts pick free loopback ports, start collector + bridge as background processes, `GET` the snapshot URL, assert JSON shape, then exit and stop children.

Requirements for `demo.sh`: `bash`, `curl`, `python3` (for ephemeral port selection). Override ports with `IPC_PORT` / `BRIDGE_PORT` if needed.

## Manual two-terminal recipe

**Terminal A — collector (retained + fixture)**

```bash
cargo build -p glass_collector -p glass_bridge

cargo run -p glass_collector -- ipc-serve \
  --listen 127.0.0.1:9876 \
  --shared-secret retained-demo-fipc \
  --procfs-retained-session demo_retained_sess \
  --procfs-from-raw-json scripts/retained_snapshot_demo/raw_observations_demo.json \
  --procfs-retained-interval-ms 500 \
  --procfs-retained-max-events 64
```

On **non-Linux**, `--procfs-from-raw-json` is **required** for this demo. On Linux you may point at a fixture (reproducible) or rely on `/proc` by omitting `--procfs-from-raw-json` and matching `--procfs-retained-session` to the poll session (not the focus of this doc).

**Terminal B — bridge**

```bash
cargo run -p glass_bridge -- \
  --listen 127.0.0.1:9781 \
  --token retained-demo-http \
  --collector-ipc-endpoint 127.0.0.1:9876 \
  --collector-ipc-secret retained-demo-fipc
```

**HTTP snapshot (bearer is HTTP token, not F-IPC secret)**

```bash
curl -sS \
  -H "Authorization: Bearer retained-demo-http" \
  http://127.0.0.1:9781/sessions/demo_retained_sess/snapshot
```

### Expected JSON shape (illustrative)

- `session_id`: `"demo_retained_sess"`
- `events`: non-empty array of normalized envelopes when the fixture produces samples
- `snapshot_cursor`: e.g. `"v0:off:1"` when events exist; for a **retained session row with zero events**, the store may report `"v0:off:0"` (known empty slice) vs `"v0:empty"` (unknown / missing session) — both are honest zero-event shapes
- `live_session_ingest`: **`false`**
- `retained_snapshot_unix_ms`: **number** when retained meta applies and a successful tick occurred (may still be present for an honestly empty retained session)
- `collector_ipc.status`: `"ok"` when F-IPC succeeded

## Automated smoke

```bash
cargo test -p integration_tests --test retained_snapshot_demo_smoke
```

This spawns real `glass-collector` and `glass_bridge` binaries (after `cargo build` for those packages), uses the same checked-in fixture, and asserts bounded / honest fields.

## Per-RPC vs retained (same binary)

- **`--procfs-session`** → fresh poll + normalize on **each** F-IPC snapshot RPC (no `retained_snapshot_unix_ms` on that path).
- **`--procfs-retained-session`** → background loop updates `SnapshotStore`; F-IPC reads the store; **do not** use the **same** session id for both flags (`ipc-serve` rejects that).

## Next implementation step

Wire **optional** operator docs or a tiny viewer dev panel that calls `GET /sessions/:id/snapshot` only — still **no** WS deltas until ingest + F-IPC transport are human-frozen per the build plan.

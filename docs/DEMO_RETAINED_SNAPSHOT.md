# Demo: retained procfs snapshot → bridge (bounded HTTP)

This walkthrough proves the **retained snapshot seam** end-to-end: `glass-collector ipc-serve` runs an optional background procfs (or **fixture**) poll loop that fills a bounded in-memory `SnapshotStore`; `glass_bridge` reads snapshots over **provisional TCP loopback F-IPC** with a **separate** HTTP bearer token.

## What this proves

- Retained mode + deterministic **`RawObservation[]` JSON** works on **any OS** (no `/proc` required for the default demo).
- `GET /sessions/:id/snapshot` returns **real** normalized JSON, **bounded** cursors (`v0:…`), and optional **`retained_snapshot_unix_ms`** when the collector last refreshed retained data for that session.
- **`live_session_ingest` is `false`** — there is **no** WebSocket delta stream and no claim of live ingest.

## What stays provisional

- **F-IPC transport** is still **TCP loopback** (dev skeleton), not a human-frozen Unix socket / peer-cred path (`docs/history/PHASE0_FREEZE_HISTORY.md`).
- **`snapshot_cursor`** and **`retained_snapshot_unix_ms`** stay **bounded-era / opaque v0** surfaces: the bounded F-04 cursor rules are closed, but live-era resync extensions and final transport semantics remain deferred.
- Retained loop **replaces** a bounded **tail** of events each tick — not an append-only live timeline.

## Fixture

Checked-in fixture (stable session id `demo_retained_sess`):

`scripts/retained_snapshot_demo/raw_observations_demo.json`

## CI coverage

GitHub Actions runs this smoke as its **own job** (easy to spot in the workflow summary):

- **Job name:** `Retained snapshot demo smoke (collector ↔ bridge F-IPC)`
- **Workflow:** `.github/workflows/ci.yml` (job id `retained_snapshot_demo_smoke`)
- **Command:** `cargo test -p integration_tests --test retained_snapshot_demo_smoke`

The full `rust` job still runs `cargo test --workspace`, which includes the same test; the dedicated job exists so failures on this path are **labeled** in the Actions UI.

## Environment preflight

### Unix (`demo.sh`)

- **Shell:** `bash` (script uses `set -euo pipefail`).
- **On PATH:** `cargo`, `curl`, `python3` (ports via `socket`; JSON validation at end).
- **Optional:** set `IPC_PORT` and `BRIDGE_PORT` if you cannot use ephemeral ports (e.g. locked-down environment).

### Windows (`demo.ps1`)

- **PowerShell** 5.1+ (`#Requires -Version 5.1`).
- **On PATH:** `cargo` (Rust toolchain).
- Ports are chosen with .NET `TcpListener` (no Python).

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

The scripts pick free loopback ports, start collector + bridge as background processes, `GET` the snapshot URL, assert JSON shape, then exit and stop children. Missing commands or fixture produce **exit code 2** with a short message (see preflight above).

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

## When `GET /sessions/:id/snapshot` returns HTTP 503

F-IPC failures are **not** part of frozen bounded F-04 — the bridge returns **503** with JSON `error` (machine key), `detail` (human text), and optional `fipc_phase` / `handshake_code`. Typical cases:

| `error` | Meaning |
|---------|---------|
| `collector_ipc_connection_refused` | Nothing listening on `--collector-ipc-endpoint` (collector not started or wrong port). Some hosts may instead surface **`collector_ipc_timeout`** with **`fipc_phase: tcp_connect`** if the TCP stack does not fail fast. |
| `collector_ipc_timeout` | RPC exceeded `--collector-ipc-timeout-secs` (or connect capped by `PROVISIONAL_FIPC_CONNECT_ATTEMPT_MAX` in the bridge client). Check `fipc_phase` (e.g. `fipc_read_handshake_line` = peer accepted TCP but never spoke F-IPC). |
| `collector_ipc_auth_mismatch` | `--collector-ipc-secret` does not match `ipc-serve --shared-secret`. |
| `collector_ipc_protocol_mismatch` | Wire or auth token version mismatch (bridge and collector built from different expectations). |
| `collector_ipc_malformed_response` | Unparseable NDJSON line from collector. |

**Bounded HTTP snapshot JSON on success is unchanged** — only the error path gained clearer keys.

## Per-RPC vs retained (same binary)

- **`--procfs-session`** → fresh poll + normalize on **each** F-IPC snapshot RPC (no `retained_snapshot_unix_ms` on that path).
- **`--procfs-retained-session`** → background loop updates `SnapshotStore`; F-IPC reads the store; **do not** use the **same** session id for both flags (`ipc-serve` rejects that).

## Next implementation step

Continue Glass v0 per `docs/long-horizon/GLASS_V0_BUILD_PLAN.md` — e.g. optional viewer dev panel calling `GET /sessions/:id/snapshot` only; durable push ingest and F-IPC transport freeze remain separate human decisions (`docs/history/PHASE0_FREEZE_HISTORY.md`).

# Glass (v0 implementation)

**Product authority:** `GLASS_FULL_ENGINEERING_SPEC_v10.md` (locked; do not reinterpret in code comments as spec changes).

**Build authority:** `GLASS_V0_BUILD_PLAN.md`.

This repository is the Glass v0 **monorepo spine**: session/pack/sanitization (Phase 1), static replay viewer shell (Phase 7), and disciplined placeholders for collector, bridge, and graph engine. There is **no** fake collector telemetry and **no** fake WebGPU rendering—only structural boundaries and real tests for what exists.

## Layout

| Path | Role |
|------|------|
| `schema/` | Canonical JSON Schema + bindings/migrations placeholders |
| `session_engine/` | Events, session append model, `.glass_pack` I/O, **pure** sanitization |
| `graph_engine/` | Graph derivation (stub crate; no presentation) |
| `collector/` | Linux collector binary (lifecycle stub only) |
| `bridge/` | Local loopback bridge binary (`glass_bridge`) + resync types — skeleton HTTP/WS (no live ingest) |
| `viewer/` | TypeScript **Tier B static replay** (`loadGlassPack`, `replayModel`) + optional **`?live=1`** **live-session skeleton** (`src/live/`) consuming bridge **`/ws`** + bounded **`GET /sessions/:id/snapshot`** (F-04 read-only); not WebGPU, not a finished live product |
| `tools/glass-pack` | CLI: validate / inspect packs; strict kinds + share-safe vs raw-dev expectations |
| `tools/golden_scenes/` | Golden-scene harness scaffold |
| `docs/` | Phase 0 tracker, boundaries, test strategy, status |
| `scripts/retained_snapshot_demo/` | Fixture + scripts for retained collector ↔ bridge snapshot demo (`docs/DEMO_RETAINED_SNAPSHOT.md`) |
| `tests/fixtures/` | Sanitization and pack fixtures |

## Verify bootstrap

```bash
# Unix
./scripts/bootstrap_check.sh

# Windows
powershell -ExecutionPolicy Bypass -File scripts/bootstrap_check.ps1
```

Or manually:

```bash
cargo fmt --check && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace
cd viewer && npm ci && npm run build && npm test && npm run lint
```

### `glass-pack` CLI

```bash
cargo run -p glass-pack -- validate path/to/file.glass_pack
cargo run -p glass-pack -- validate path/to/share.glass_pack --strict-kinds --expect-share-safe
cargo run -p glass-pack -- validate path/to/dev.glass_pack --expect-raw-dev
cargo run -p glass-pack -- info path/to/file.glass_pack
cargo run -p glass-pack -- info path/to/file.glass_pack --json
```

Procfs dev → share flow: `glass-collector normalize-procfs` (raw pack) → `glass-collector export-procfs-pack` (sanitized) → `glass-pack validate … --expect-share-safe`. Details: `tools/glass-pack/README.md`.

### Local bridge (Phase 5 skeleton)

HTTP bearer token (for `Authorization: Bearer …` and optional WS `?access_token=` on loopback) is **separate** from **F-IPC** shared secret:

```bash
cargo run -p glass_bridge -- --help
cargo run -p glass_bridge -- --token dev-http-bearer
```

Optional **bounded snapshot** via provisional TCP to `glass-collector ipc-serve` (loopback only):

```bash
cargo run -p glass-collector -- ipc-serve --shared-secret fipc-dev --listen 127.0.0.1:9876
cargo run -p glass_bridge -- --token dev-http-bearer --collector-ipc-endpoint 127.0.0.1:9876 --collector-ipc-secret fipc-dev
```

Default bridge listen: `127.0.0.1:9781`. **Live-session WebSocket** (`/ws`) exists for bounded polling + optional `session_delta` v0 when configured — see `docs/IMPLEMENTATION_STATUS.md`, `docs/contracts/live_session_ws_session_delta_v0.md`, and `viewer/src/live/`. **WebGPU live scene** is still out of scope.

**Retained snapshot demo** (collector background poll + fixture + bridge + `GET /sessions/…/snapshot`): see [`docs/DEMO_RETAINED_SNAPSHOT.md`](docs/DEMO_RETAINED_SNAPSHOT.md) and `scripts/retained_snapshot_demo/` (`demo.ps1` / `demo.sh`). CI runs `cargo test -p integration_tests --test retained_snapshot_demo_smoke` as a **named** Actions job (`Retained snapshot demo smoke (collector ↔ bridge F-IPC)`).

## Status

See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

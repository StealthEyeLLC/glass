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
| `viewer/` | TypeScript **Tier B static replay** (`loadGlassPack`, `replayModel`) + optional **`?live=1`** **live-session shell** (`src/live/`): **`GET /capabilities`** preflight, **`/ws`**, bounded **`GET /sessions/:id/snapshot`** (F-04 read-only), sessionStorage convenience (no token persistence); **Vertical Slice v0–v17** — one bounded demo path: shared Scene v0 + Drawable Primitives in replay and live (Canvas 2D; live may use WebGPU geometry + Canvas overlay with **v17** compare-baseline parity for selection outline + spec; compare, evidence, temporal lens, episodes, **bounded claims + receipts** with **v16** presentation-grade trust surfaces — evidence-stated, not AI analysis); **v15** adds a small **canonical scenario** pack suite under **`tests/fixtures/canonical_scenarios_v15/`** — see `docs/VERTICAL_SLICE_V0.md`); not a finished live product |
| `tools/glass-pack` | CLI: validate / inspect packs; strict kinds + share-safe vs raw-dev expectations |
| `tools/golden_scenes/` | Golden-scene harness scaffold |
| `docs/` | Phase 0 tracker, boundaries, test strategy, status |
| `scripts/retained_snapshot_demo/` | Fixture + scripts for retained collector ↔ bridge snapshot demo (`docs/DEMO_RETAINED_SNAPSHOT.md`) |
| `tests/fixtures/` | Pack fixtures; **`vertical_slice_v0/`** — flagship Tier B demo; **`canonical_scenarios_v15/`** — small synthetic bounded scenario packs (Vertical Slice v15, `docs/VERTICAL_SLICE_V0.md`) |

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

Default bridge listen: `127.0.0.1:9781`. **Live-session WebSocket** (`/ws`) exists for bounded polling + optional `session_delta` v0 when configured — see `docs/IMPLEMENTATION_STATUS.md`, `docs/contracts/live_session_ws_session_delta_v0.md`, and `viewer/src/live/`. **`?live=1`** may render Scene v0 with **WebGPU geometry + Canvas text overlay** when `navigator.gpu` is available — still bounded, not Phase-6 topology.

**Retained snapshot demo** (collector background poll + fixture + bridge + `GET /sessions/…/snapshot`): see [`docs/DEMO_RETAINED_SNAPSHOT.md`](docs/DEMO_RETAINED_SNAPSHOT.md) and `scripts/retained_snapshot_demo/` (`demo.ps1` / `demo.sh`). CI runs `cargo test -p integration_tests --test retained_snapshot_demo_smoke` as a **named** Actions job (`Retained snapshot demo smoke (collector ↔ bridge F-IPC)`).

## Vertical Slice v0 (demo path)

One bounded scenario through replay + live: same Scene System v0 strip, honest wire semantics (no fake topology). Vertical Slice v3 adds **bounded regions** and compositional underlays; v4 adds **bounded emphasis** (pulse/flash when tail, wire mode, resync/reconcile, or replay cursor **actually changes** between paints); v5–v7 add **bounded selection**, **focus**, and **spatial reflow** (re-allocate strip heights / lane widths from grouping — **not** a second scene or graph drill-down); later slices add **compare**, **evidence**, **temporal lens**, **episodes**, **claims/receipts** (v13–v14), **v15 canonical scenario packs** (breadth tests — **not** extra product chrome), **v16** presentation for the same bounded receipts/evidence (readability and hierarchy — **not** new authority), and **v17** live hybrid/renderer parity (stable selection outline and shared compare in spec paths — **not** new surfaces). Still **not** a graph and **not** idle animation. **Quick replay check:** from `viewer/` run `npm run dev`, then either **Open file** on `tests/fixtures/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack`, or open the dev server with **`?fixture=vertical_slice_v0`** (dev-only — see [docs/VERTICAL_SLICE_V0.md](docs/VERTICAL_SLICE_V0.md)). Static `dist/` does not auto-load fixtures. **Scenario packs:** `npm run verify:canonical-scenarios-v15` from `viewer/`.

## Status

See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

# Glass (v0)

**Bounded investigation surface above runtime telemetry** — open-source monorepo: packs, sanitization, Tier B static replay (default), optional loopback live shell.

**Product hook:** Glass turns bounded runtime activity into an inspectable claim chain: scene, change, evidence, receipt.

---

## Where to start (doc order)

| Order | Doc | Why |
|-------|-----|-----|
| 1 | **[VISION.md](VISION.md)** | Boundaries, strategy, standalone-first / ingest-agnostic framing, out-of-scope |
| 2 | **This README** | Layout, fastest run, verify commands |
| 3 | **[docs/VERTICAL_SLICE_V0.md](docs/VERTICAL_SLICE_V0.md)** | Flagship path, slice history, canonical scenarios |
| 4 | **[docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md)** | What exists vs scaffold |
| 5 | **[docs/REPO_BOUNDARIES.md](docs/REPO_BOUNDARIES.md)** | Crate ownership |
| 6 | **[docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md)** | How CI maps to behavior |

**Authority:** `GLASS_FULL_ENGINEERING_SPEC_v10.md` (locked product spec). **Plan:** `GLASS_V0_BUILD_PLAN.md`.

---

## Product (one paragraph)

Glass ships a **real** **`.glass_pack`** path, **pure** sanitization for export, a **Tier B** static replay viewer (`loadGlassPack`, bounded Scene System v0, claims/receipts/evidence/compare), and an optional **`?live=1`** session UI against a **loopback** bridge (bounded HTTP snapshot + WebSocket — contracts frozen where documented). There is **no** fake collector feed and **no** fake graph: the UI states what the **bounded** prefix/tail supports. **Freeze-candidate in-repo** applies to this **bounded showcase path** only — not to production-scale ingest, **F-IPC** finality, or Phase-6 full topology (see **VISION.md**).

---

## Flagship bounded path

- **Pack:** `tests/fixtures/canonical_scenarios_v15/canonical_v15_append_heavy.glass_pack` — session `canonical_v15_append_heavy`, append-heavy Tier B depth (compare, evidence, episodes, receipts, temporal lens).
- **Minimal smoke:** `tests/fixtures/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack` (3 events) — fast CI.
- **Breadth:** four scenario packs under `tests/fixtures/canonical_scenarios_v15/` — replace, append, calm/steady, file-heavy (see that folder’s `README.md`).

---

## Claim chain and bounded honesty

| Step | Meaning |
|------|---------|
| **Scene** | Compiled **Glass Scene v0** strip from bounded prefix/tail — not full history. |
| **Change** | **Compare** vs an honest baseline (immediate prior or temporal ring) — not a causal graph. |
| **Evidence** | Drilldown **rows/facts** from the current bounded window — not a complete trace. |
| **Receipt** | **Viewer-derived** bounded claim text; **weak** / **unavailable** when support is thin — **not** a collector certificate. |

Live: WebSocket tail and HTTP snapshot stay **distinct** (not merged into one pretend log). Replay: index-ordered pack prefix; receipts/evidence from bounded frames only.

---

## Fastest first run (replay)

1. `cd viewer && npm ci && npm run dev`
2. **Open file** → `tests/fixtures/canonical_scenarios_v15/canonical_v15_append_heavy.glass_pack`  
   Or **dev-only:** append **`?fixture=flagship`** (see `docs/VERTICAL_SLICE_V0.md`). Static **`dist/`** does not auto-load fixtures.
3. Follow **How to read this surface** in the shell: scene → evidence → episodes → claims → receipt → temporal lens.

**Verify scenarios from `viewer/`:** `npm run verify:canonical-scenarios-v15` · `npm run verify:vertical-slice-fixture`

---

## Showcase path vs future full system

| Bounded showcase (v0) | Not claimed here |
|------------------------|-------------------|
| Tier B replay + optional `?live=1` + canonical suite + green CI | Production collector/bridge at scale |
| Freeze-candidate **for this path** in-repo | **F-IPC** transport freeze |
| Scene System v0 + Drawable Primitives + bounded claims | Phase-6 **full topology runtime** |

---

## Screenshots / GIFs

Optional assets: **[docs/media/README.md](docs/media/README.md)** (placeholders and naming suggestions). Not required to build or test.

---

## Layout

| Path | Role |
|------|------|
| `schema/` | Canonical JSON Schema + bindings/migrations placeholders |
| `session_engine/` | Events, session append model, `.glass_pack` I/O, **pure** sanitization |
| `graph_engine/` | Graph derivation (stub crate; no presentation) |
| `collector/` | Linux collector binary (lifecycle stub only) |
| `bridge/` | Local loopback bridge (`glass_bridge`) + resync types — HTTP/WS per docs |
| `viewer/` | Tier B static replay + optional **`?live=1`** live shell — **Vertical Slice v0–v23** (see `docs/VERTICAL_SLICE_V0.md`) |
| `tools/glass-pack` | CLI: validate / inspect packs; strict kinds + share-safe vs raw-dev |
| `tools/golden_scenes/` | Golden-scene harness scaffold |
| `docs/` | Status, boundaries, tests, contracts, **media** placeholders |
| `scripts/retained_snapshot_demo/` | Retained collector ↔ bridge snapshot demo (`docs/DEMO_RETAINED_SNAPSHOT.md`) |
| `tests/fixtures/` | **`vertical_slice_v0/`**, **`canonical_scenarios_v15/`** |

---

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

Default bridge listen: `127.0.0.1:9781`. **Live-session WebSocket** (`/ws`) — bounded polling + optional `session_delta` v0 when configured — see `docs/IMPLEMENTATION_STATUS.md`, `docs/contracts/live_session_ws_session_delta_v0.md`, and `viewer/src/live/`. **`?live=1`** may use **WebGPU geometry + Canvas text overlay** when `navigator.gpu` is available — still bounded, not Phase-6 topology.

**Retained snapshot demo** (collector poll + fixture + bridge + `GET /sessions/…/snapshot`): [`docs/DEMO_RETAINED_SNAPSHOT.md`](docs/DEMO_RETAINED_SNAPSHOT.md) and `scripts/retained_snapshot_demo/`. CI: `cargo test -p integration_tests --test retained_snapshot_demo_smoke`.

---

## Status

[docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md)

---

## Vertical slice (overview)

One bounded narrative through replay and live: same Scene System v0 strip, honest wire semantics. Slice **v18** names the **flagship** append-heavy pack; **v15** adds the **canonical scenario suite**; **v19–v22** tighten trust handoff, reading order, framing parity, and freeze verdict. **v23** adds **public release prep**: **VISION.md**, README **reading order**, **docs/media** placeholders — **not** new product subsystems. Details: [docs/VERTICAL_SLICE_V0.md](docs/VERTICAL_SLICE_V0.md).

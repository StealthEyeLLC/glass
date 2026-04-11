# Glass (v0)

**Glass turns bounded runtime activity into an inspectable claim chain: scene, change, evidence, receipt.**

**What this is:** A **bounded investigation surface** above runtime telemetry — `.glass_pack` I/O, Tier B **static replay** (default), optional loopback **`?live=1`**. **Freeze-candidate in-repo for the bounded showcase path only** — not production ingest at scale, not **F-IPC** finality, not Phase-6 full topology (see **[VISION.md](VISION.md)**).

---

## Standout interaction (the real product)

| | |
|--|--|
| **scene** | Current bounded **Glass Scene v0** — prefix/tail honest, not full history. |
| **change** | **Compare** vs a declared baseline — not causal inference. |
| **evidence** | Drilldown **rows/facts** from the bounded window — not a complete trace. |
| **receipt** | **Viewer-derived** claim text; **weak** / **unavailable** when support is thin — not a collector certificate. |

Live: WS tail and HTTP snapshot stay **separate**. Replay: index-ordered prefix; same compilers.

---

## Try the flagship (fastest)

**Easy path (what to do):**

1. Run the viewer locally (`cd viewer`, then `npm ci` and `npm run dev` — see **Verify bootstrap** below).
2. In the replay shell, use **Try the flagship** → **Load flagship demo** (dev only) **or** **Open file** / drop a pack — file `tests/fixtures/canonical_scenarios_v15/canonical_v15_append_heavy.glass_pack`.
3. Expand **How to read** when you want the scan tip; scroll the page top-to-bottom: **Scene** → **Evidence** → **Story cards** → **Claims** → receipt → **Time context** (longer wording stays under **Technical** / **details**).

**Technical (how it loads):** Static **`dist/`** does not auto-load fixtures — use **Open file** with the committed pack. **Dev-only:** the shell can load the same bytes via `?fixture=flagship` ([details](docs/VERTICAL_SLICE_V0.md)). Live **`?live=1`** is optional and documented in the UI behind **Advanced** / collapsed sections — still **local** bridge semantics, not cloud-hosted Glass.

**Verify (from `viewer/`):** `npm run verify:canonical-scenarios-v15` · `npm run verify:vertical-slice-fixture`

---

## Flagship depth vs scenario breadth

| | Pack / role |
|--|-------------|
| **Flagship (depth)** | `canonical_v15_append_heavy.glass_pack` — session `canonical_v15_append_heavy`, append-heavy Tier B: compare, evidence, episodes, claims, receipts, temporal lens. **Primary** demo. |
| **Smoke (CI)** | `tests/fixtures/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack` — 3 events, fast checks. |
| **Breadth (suite)** | Four packs under `tests/fixtures/canonical_scenarios_v15/` — replace, append, calm/steady, file-heavy ([folder README](tests/fixtures/canonical_scenarios_v15/README.md)). **Supporting** proof, not a second product. |

---

## Where to read next

| Doc | Use |
|-----|-----|
| **[VISION.md](VISION.md)** | Strategy, standalone-first, ingest-agnostic, explicit out-of-scope |
| **[docs/VERTICAL_SLICE_V0.md](docs/VERTICAL_SLICE_V0.md)** | Slice history, flagship naming |
| **[docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md)** | Implemented vs scaffold |
| **[docs/REPO_BOUNDARIES.md](docs/REPO_BOUNDARIES.md)** | Crate ownership |
| **[docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md)** | CI ↔ behavior map |

**Authority:** `GLASS_FULL_ENGINEERING_SPEC_v10.md` · **Plan:** `GLASS_V0_BUILD_PLAN.md`

---

## Showcase vs what this repo does not claim

| In scope (bounded showcase) | Out of scope (honest) |
|-------------------------------|------------------------|
| Tier B replay + optional `?live=1` + canonical suite + green CI | Production collector/bridge operations at scale |
| Scene System v0 + bounded claims/receipts | **F-IPC** transport freeze |
| | Phase-6 **full topology runtime** |

---

## Screenshots (bounded showcase)

**How these were taken:** Vite dev server (`npm run dev` in `viewer/`); replay frames use **`?fixture=flagship`** → `canonical_v15_append_heavy.glass_pack`; live frame uses **`?live=1`**. Regenerate with **`npm run capture:showcase-media -- http://127.0.0.1:<port>`** (dev server URL, e.g. `5173`) after `npx playwright install chromium` once. Synthetic committed fixtures only — not production telemetry.

| | |
|:--|:--|
| ![01 — Replay overview (flagship pack)](docs/media/01-replay-flagship-overview.png) | **01 — Replay overview.** Reading order, flagship callout, scene strip, bounded trust band (evidence → episodes → claims → receipt → temporal lens). |
| ![02 — Claim chain / receipt](docs/media/02-claim-chain-receipt.png) | **02 — Claim chain.** Bounded claim chips + **`glass.receipt.v0`** receipt panel. |
| ![03 — Temporal lens](docs/media/03-temporal-lens-compare.png) | **03 — Temporal lens.** Compare baseline context (bounded ring — not a full history timeline). |
| ![04 — Live shell](docs/media/04-live-shell-overview.png) | **04 — Live shell.** `?live=1`: bridge form, bounded visual surface, provenance strip (loopback capture; no tokens). |

Naming and re-capture checklist: **[docs/media/README.md](docs/media/README.md)**. Assets are **not** required to build or test.

---

## Layout

| Path | Role |
|------|------|
| `schema/` | Canonical JSON Schema + bindings/migrations placeholders |
| `session_engine/` | Events, session append model, `.glass_pack` I/O, **pure** sanitization |
| `graph_engine/` | Graph derivation (stub crate; no presentation) |
| `collector/` | Linux collector binary (lifecycle stub only) |
| `bridge/` | Local loopback bridge (`glass_bridge`) + resync types — HTTP/WS per docs |
| `viewer/` | Tier B static replay + optional **`?live=1`** — **Vertical Slice v0–v26** ([docs/VERTICAL_SLICE_V0.md](docs/VERTICAL_SLICE_V0.md)) |
| `tools/glass-pack` | CLI: validate / inspect packs; strict kinds + share-safe vs raw-dev |
| `tools/golden_scenes/` | Golden-scene harness scaffold |
| `docs/` | Status, boundaries, tests, contracts, **media** guidance |
| `scripts/retained_snapshot_demo/` | Retained collector ↔ bridge snapshot demo ([docs/DEMO_RETAINED_SNAPSHOT.md](docs/DEMO_RETAINED_SNAPSHOT.md)) |
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

One bounded narrative through replay and live. **v18** = flagship pack; **v15** = canonical suite; **v19–v22** = trust UX and freeze verdict; **v23** = public doc surface; **v24** = landing audit; **v25** = committed **docs/media** PNGs for README — **not** new subsystems. Details: [docs/VERTICAL_SLICE_V0.md](docs/VERTICAL_SLICE_V0.md).

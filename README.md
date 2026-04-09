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
| `bridge/` | Local API / resync contracts (types + docs; no browser server yet) |
| `viewer/` | TypeScript static replay shell (Tier B); live mode is explicitly absent |
| `tools/glass-pack` | CLI: validate/list packs |
| `tools/golden_scenes/` | Golden-scene harness scaffold |
| `docs/` | Phase 0 tracker, boundaries, test strategy, status |
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

### `glass-pack` CLI (scaffold)

```bash
cargo run -p glass-pack -- validate path/to/file.glass_pack
cargo run -p glass-pack -- info path/to/file.glass_pack
```

## Status

See [docs/IMPLEMENTATION_STATUS.md](docs/IMPLEMENTATION_STATUS.md).

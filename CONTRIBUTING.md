# Contributing

## Read this first

**Current shipped bounded showcase truth:**

- `README.md`
- `docs/README.md`
- `VISION.md`
- `docs/IMPLEMENTATION_STATUS.md`
- `docs/TEST_STRATEGY.md`
- `docs/REPO_BOUNDARIES.md`

**Milestone history:** `docs/VERTICAL_SLICE_V0.md`

**Long-horizon architecture references, not the current launch contract:** `docs/long-horizon/GLASS_FULL_ENGINEERING_SPEC_v10.md`, `docs/long-horizon/GLASS_V0_BUILD_PLAN.md`

## Product rules

- Preserve the core idea: **Glass turns bounded runtime activity into an inspectable claim chain: scene, change, evidence, receipt.**
- Keep replay as the public front door. Treat local live as secondary and honest about its setup/provisional state.
- Do not add fake topology, fake causality, fake full history, or fake AI-summary behavior.
- Do not let the UI imply more certainty than the bounded window actually supports.
- If a change makes the repo *look* like it ships more than it proves, tighten the copy or do not ship it.

## Verify before opening a PR

```bash
# Unix
./scripts/bootstrap_check.sh

# Windows
powershell -ExecutionPolicy Bypass -File scripts/bootstrap_check.ps1
```

Those bootstrap scripts are intended to match the bounded-showcase proof that viewer CI runs: `build`, `test`, `lint`, `verify:vertical-slice-fixture`, and `verify:canonical-scenarios-v15`. They prefer `npm ci` and fall back to `npm install` if a local file lock blocks a clean reinstall.

Or run the full gates manually:

```bash
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

cd viewer
npm ci
npm run build
npm test
npm run lint
npm run verify:vertical-slice-fixture
npm run verify:canonical-scenarios-v15
```

## PR expectations

- Say whether the change affects replay, live, docs, trust surfaces, or repo packaging.
- Call out any wording changes that alter the public launch surface.
- Keep screenshots and README copy aligned with the actual shipped UI.
- Do not merge doc claims that the product surface does not back up.

## HVT rules file

Edits to `collector/config/hvt_rules.toml`:

1. Keep `pattern` count ≤ `cap` (≤ 20 for v0).
2. Add a one-line justification in the PR description.
3. Do not add generic catch-all secret patterns; use explicit paths/globs.

CI fails if the count exceeds the cap.

## Schema / sanitization

Changes to paths, argv, network, or IPC-shaped event attributes must update `tests/fixtures/sanitization/` and keep `cargo test -p session_engine` green.

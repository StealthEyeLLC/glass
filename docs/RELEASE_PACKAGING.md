# Release packaging (bounded showcase)

Use this file when opening the launch PR, drafting release notes, or tightening repo metadata. Keep the claim narrow. Keep replay first. Keep the optional local live shell visible but secondary.

## One-line framing

Glass is a replay-first bounded investigation surface: one honest path from scene to change to evidence to receipt, with optional local live mode kept local-only and secondary.

## What Glass is

- A replay-first bounded investigation surface above runtime telemetry
- A concrete claim chain: scene -> change -> evidence -> receipt
- A shipped bounded showcase with committed fixtures, tests, and media
- An optional local `?live=1` shell for bounded bridge-backed inspection, not the front door

## What Glass is not

- Not cloud-hosted Glass
- Not production collector or bridge operations at scale
- Not final F-IPC transport
- Not Phase-6 full topology runtime
- Not a generic observability dashboard or AI runtime explainer

## Why replay is the flagship

- Replay is the most honest shipped path in this repo.
- Replay has deterministic proof: committed packs, viewer verification, `glass-pack` validation, CI, and stable media.
- Replay lets the repo demonstrate the claim chain without pretending that live continuity or hosted infrastructure is already solved.

## What the repo concretely proves

- `cargo test --workspace`
- `viewer` build, test, lint, and fixture verification
- `glass-pack` validation on committed `.glass_pack` fixtures
- Retained snapshot collector ↔ bridge demo seam
- Committed showcase media captured from the real viewer surface

## Suggested repo description

Replay-first bounded investigation surface: scene, change, evidence, receipt. Optional live shell is local-only and secondary.

## Suggested topics

- `runtime`
- `replay`
- `developer-tools`
- `systems`
- `rust`
- `typescript`
- `webgpu`

## Suggested PR title

`glass: package the bounded showcase for public release`

## Suggested PR summary

- Rebuild the repo front door around the replay-first bounded showcase path.
- Separate current-truth docs from long-horizon/history material and add explicit release/OSS surfaces.
- Add restrained flagship media and narrow release framing without broadening the product claim.

## Suggested PR test plan

- [ ] `./scripts/bootstrap_check.sh`
- [ ] `powershell -ExecutionPolicy Bypass -File scripts/bootstrap_check.ps1`
- [ ] `cargo run -p glass-pack -- validate tests/fixtures/canonical_scenarios_v15/canonical_v15_append_heavy.glass_pack --strict-kinds`
- [ ] `npm run capture:showcase-media -- http://127.0.0.1:<port>` from `viewer/` when media changes

## Suggested release note

Glass now presents a cleaner public bounded-showcase path: replay first, one flagship pack, honest proof surfaces, and tighter separation between the shipped repo surface and long-horizon architecture history. The repo proves bounded replay, fixture validation, local loopback live setup, and the claim chain from scene to change to evidence to receipt; it does not claim cloud hosting, production ingest scale, final F-IPC transport, or full topology runtime.

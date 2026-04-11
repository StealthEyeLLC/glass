# Vertical Slice v0 — known-good Tier B `.glass_pack`

**Vertical Slice v18:** the **flagship product demo** uses **`canonical_v15_append_heavy.glass_pack`** under **`tests/fixtures/canonical_scenarios_v15/`** (14 events, append semantics). This folder remains the **minimal** strict smoke path for **`npm run verify:vertical-slice-fixture`** and fast CI.

## Contents

| File | Role |
|------|------|
| `glass_vertical_slice_v0_tier_b.glass_pack` | Minimal **`glass.pack.v0.scaffold`** ZIP: `manifest.json` + `events.jsonl` (3× `process_poll_sample`, session `glass_vertical_slice_v0`). |

## Synthetic / honest labeling

Events are **synthetic** (fixture-only `adapter: "fixture"`, `attrs.note: synthetic_vertical_slice_v0_fixture`). They exist so CI and docs have **one deterministic** path: load → strict_kinds → `compileReplayToGlassSceneV0` with bounded honesty. This is **not** live collector telemetry and **does not** prove bridge, F-IPC, or ingest.

## Regenerate

From `viewer/`:

```bash
npm run fixture:vertical-slice
```

Commit the updated `.glass_pack` if manifest or event shape intentionally changes.

## Verify (Rust validator)

From `viewer/`:

```bash
npm run verify:vertical-slice-fixture
```

Or from repo root:

```bash
cargo run -p glass-pack -- validate tests/fixtures/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack --strict-kinds
```

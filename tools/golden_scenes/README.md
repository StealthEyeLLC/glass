# Golden-scene harness (scaffold)

Phase 6 will capture deterministic WebGPU frames here. This directory holds **policy and drivers only** until the renderer exists.

- **capture.mjs** — placeholder entry (exits 0). Replace with real headless capture when WebGPU path is stable.
- **baselines/** — (optional) committed images only when small; large artifacts stay local/CI cache per `docs/PHASE0_FREEZE_TRACKER.md`.

CI: `.github/workflows/ci.yml` runs `node tools/golden_scenes/capture.mjs` as a smoke check.

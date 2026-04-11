# Visual regression policy (Phase 0 pending)

**Status:** Framework not active — **F-01 open** in `docs/history/PHASE0_FREEZE_HISTORY.md`.

## Decision required

Choose **one**:

1. **Pixel diff** — PNG baseline + perceptual tolerance; sensitive to GPU/driver.
2. **Perceptual hash** — faster, looser; may miss subtle regressions.

## Baseline updates (once active)

- Intentional visual change = PR labeled `baseline-update` + before/after artifacts.
- **Forbidden:** commit new baselines to silence failing CI without review.

## Protected surfaces (from build plan)

Shaders, LOD, edge bundling, frosted-glass zones, emphasis halos, primary demo legibility.

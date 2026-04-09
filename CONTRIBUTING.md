# Contributing

**Product spec:** `GLASS_FULL_ENGINEERING_SPEC_v10.md` (locked)  
**Build plan:** `GLASS_V0_BUILD_PLAN.md`

## HVT rules file

Edits to `collector/config/hvt_rules.toml`:

1. Keep `pattern` count ≤ `cap` (≤ 20 for v0).
2. One-line justification per pattern in PR description.
3. No generic “catch-all secret” entries — explicit paths/globs only (spec §16.2A).

CI fails if count exceeds cap.

## Schema / sanitization

Changes to paths, argv, network, or IPC-shaped event attributes must update `tests/fixtures/sanitization/` and keep `cargo test -p session_engine` green.

## Verify

```bash
./scripts/bootstrap_check.sh
```

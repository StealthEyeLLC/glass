# Sanitization trust criteria (maintainers)

**Authority:** spec §28.4, §30.2; build plan Phase 1.

## Rule

A `.glass_pack` is a **share candidate** only if:

1. `sanitized: true` and `human_readable_redaction_summary` is **complete** for the applied profile (lists what was removed or masked).
2. CI sanitization matrix + leak tests pass for the schema/pack revision.
3. At least one **manual** spot-check on a realistic workspace before public posting (until automated “messy env” job exists).

If maintainers would not paste the summary next to a Reddit/GitHub link, **do not** recommend `share_safe_recommended: true`.

## Sign-off

Record in release notes who ran the manual spot-check (role + date).

## Implementation reference

- Code: `session_engine::sanitization` (recursive string rules + argv + socket keys + **`attrs.exe`** → `[REDACTED_ABS_PATH]` for share export)
- Export wiring: `session_engine::export::materialize_share_safe_procfs_pack_bytes` (procfs lane); CLI `glass-collector export-procfs-pack`
- **Artifact check:** `glass-pack validate … --expect-share-safe` confirms export-lane **manifest fields** only — not a substitute for manual review (§28.4).
- Fixtures: `tests/fixtures/sanitization/`

**Does not claim:** complete secret scanning, stable identity after redaction, or that `comm` / numeric PIDs are safe for every audience — operators still follow §28.4 before recommending share.

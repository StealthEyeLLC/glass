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

- Code: `session_engine::sanitization` (`SANITIZE_PROFILE_VERSION` = **`sanitize_default.1.provisional`**) — recursive string rules + argv + socket keys + **`attrs.exe`** → `[REDACTED_ABS_PATH]`; **file-lane kinds** (provisional, F-05 not frozen): **`attrs.relative_path`**, **`attrs.watch_root`**, **`fs_poll_rel:`…** entity suffix redacted as documented in summary lines.
- Export wiring: `materialize_share_safe_procfs_pack_bytes` (procfs manifest); **`materialize_share_safe_file_lane_pack_bytes`** (file-lane manifest); CLI **`export-procfs-pack`** / **`export-file-lane-pack`**
- **Artifact check:** `glass-pack validate … --expect-share-safe` confirms export-lane **manifest fields** only — not a substitute for manual review (§28.4).
- Fixtures: `tests/fixtures/sanitization/` (includes **`file_lane_poll_paths.json`** matrix case)

**Does not claim:** complete secret scanning, stable identity after redaction (file-lane **entity_id** changes on export), or that `comm` / numeric PIDs are safe for every audience — operators still follow §28.4 before recommending share. **File-lane path redaction is explicitly provisional** until F-05 human sign-off.

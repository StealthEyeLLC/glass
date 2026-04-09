# Sanitization fixture matrix

Each `*.json` file is a JSON array of `NormalizedEventEnvelope` values consumed by `session_engine/tests/sanitization_fixtures.rs`.

Categories:

- `private_ip.json` — RFC1918-style literals in attrs
- `home_path.json` — requires `SanitizationProfile.home_dir_prefix = Some("/home/testuser")` in test
- `tilde_path.json` — `~/` and bare `~` in string attrs → `[HOME]` (F-05 / provisional heuristic; see `PHASE0_FREEZE_TRACKER`)
- `argv_secrets.json` — `attrs.argv` tail redaction
- `internal_hostname.json` — `.corp` / `.local` / `.internal` suffix handling (provisional rules)
- `sensitive_socket.json` — socket path under `/var/run` + `.sock`
- `causality_negative.json` — public paths only; seq / entity ids must be unchanged after sanitize
- `procfs_exe_path.json` — `process_poll_sample` with `attrs.exe` absolute path → `[REDACTED_ABS_PATH]` on export profile

Add new files when new redaction rules ship; update human freeze doc when defaults change.

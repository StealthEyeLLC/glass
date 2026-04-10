# glass-pack

CLI for **validating and inspecting** `glass.pack.v0.scaffold` ZIPs (`manifest.json` + `events.jsonl`). Uses `session_engine` parsers and parity checks with Tier B `strict_kinds` when requested.

## Commands

```bash
cargo run -p glass-pack -- validate <path.glass_pack>
cargo run -p glass-pack -- validate <path.glass_pack> --strict-kinds
cargo run -p glass-pack -- validate <path.glass_pack> --strict-kinds --expect-share-safe
cargo run -p glass-pack -- validate <path.glass_pack> --expect-raw-dev
cargo run -p glass-pack -- info <path.glass_pack>
cargo run -p glass-pack -- info <path.glass_pack> --json
```

- `--strict-kinds` — alias: `--strict` (legacy). Enforces v0 known event kinds (matches viewer `strict_kinds`).
- `--expect-share-safe` — manifest must have `sanitized: true`, non-empty redaction summary, profile id + version (export lane; does **not** mean “safe to post”).
- `--expect-raw-dev` — manifest must **not** be `sanitized` (typical `normalize-procfs` artifact). Mutually exclusive with `--expect-share-safe`.
- `--json` — machine-readable summary on success (`validate` / `info`).

## Procfs workflow (implementation)

1. `glass-collector normalize-procfs --output dev.glass_pack` — unsanitized session snapshot.
2. `glass-collector export-procfs-pack --output share.glass_pack` — share-lane sanitized pack.
3. `glass-pack validate share.glass_pack --strict-kinds --expect-share-safe` — artifact checks.
4. Open `share.glass_pack` in Tier B static replay (viewer).

## File-lane workflow (directory poll — provisional share-safe)

1. `glass-collector normalize-file-lane --watch-root DIR --output dev.glass_pack` — unsanitized (or `--from-raw-json` fixture).
2. `glass-collector export-file-lane-pack --watch-root DIR --output share_fs.glass_pack` — same sanitize profile (**`sanitize_default.1.provisional`**); path redaction for file-lane is **explicitly provisional** (F-05).
3. `glass-pack validate share_fs.glass_pack --strict-kinds --expect-share-safe`.

See `docs/IMPLEMENTATION_STATUS.md` and `docs/SANITIZATION_TRUST_CRITERIA.md`.

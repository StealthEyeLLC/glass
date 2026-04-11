# Security policy

## Scope

Glass currently ships a **replay-first bounded showcase**. Security reports are most useful when they affect code or assets that actually ship in this repo, especially:

- share-safe pack export and sanitization
- `.glass_pack` parsing and validation in `session_engine`, `tools/glass-pack`, and the viewer
- loopback bridge auth or the optional local `?live=1` shell
- committed fixtures, scripts, or docs that could leak secrets or encourage unsafe handling

Out of scope for the current repo claim:

- long-horizon/spec-only material under `docs/long-horizon/`
- production ingest scale, cloud hosting, or final F-IPC transport not shipped here
- purely local developer environment mistakes that do not create a repo-level issue

## Reporting

Do **not** post exploit details or sensitive payloads in a public issue.

Preferred path:

1. Use GitHub private vulnerability reporting / security advisories for this repository if it is enabled.
2. Include the affected commit or branch, impact, reproduction steps, and whether the issue can leak data from a `.glass_pack` or local bridge session.

Fallback if private reporting is unavailable:

1. Open a minimal public issue requesting a private contact path.
2. Do **not** include secrets, exploit payloads, or private data in that public issue.

## Response posture

- Triage focuses on the shipped bounded showcase first.
- Issues in provisional or long-horizon paths are still useful, but they should be labeled honestly.
- Coordinated disclosure is preferred once a fix or mitigation exists.

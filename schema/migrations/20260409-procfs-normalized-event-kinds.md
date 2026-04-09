# Migration note: procfs polling normalized event kinds (2026-04-09)

## Added `kind` strings (spec §12.5 strict-set extension)

These are **not** kernel lifecycle truth; they describe `/proc` polling semantics only:

| `kind` | Meaning |
|--------|---------|
| `process_poll_sample` | One process row from a single `/proc` poll snapshot. |
| `process_seen_in_poll_gap` | PID present in this poll but not the previous (polling-derived). |
| `process_absent_in_poll_gap` | PID absent in this poll vs previous (polling-derived). |

## Code / consumer updates

- `session_engine::validate::KNOWN_EVENT_KINDS_V0`
- `viewer/src/pack/types.ts` — `KNOWN_EVENT_KINDS_V0` (Tier B `strict_kinds` validation)

## JSON Schema

`schema/glass_event_schema.json` does not enumerate `kind`; no structural schema change required.

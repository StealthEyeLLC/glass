# Release media (screenshots / GIFs)

**Optional.** Nothing in this directory is required to build, test, or run Glass. **Do not commit** fabricated screenshots — capture the real viewer or use **synthetic fixtures** only.

## Ordered assets (preferred filenames)

Use this **order** when embedding in README or release notes (flagship story first):

| # | Filename | What it must show |
|---|----------|-------------------|
| 01 | `01-replay-flagship-overview.png` | **Static replay** with **`canonical_v15_append_heavy.glass_pack`** loaded: hero + **How to read this surface** visible, scene canvas, bounded trust band (evidence / episodes / claims / temporal lens) — **full vertical slice** in one frame. |
| 02 | `02-claim-chain-receipt.png` | **Claim chips** + **receipt** panel (any **glass.receipt.v0** structure visible); optional evidence row highlight — proves **scene → … → receipt** without cropping the chain. |
| 03 | `03-temporal-lens-compare.png` | **Temporal lens** + compare baseline context (replay) — shows **change** step is bounded, not a full timeline. |
| 04 | `04-live-shell-overview.png` | **`?live=1`** — bridge form + bounded visual surface + provenance strip; **no** tokens, **no** secrets in frame. |

**GIF (optional):** `05-replay-scrub-flagship.gif` — short scrub or step through flagship pack; keep **under ~15s**, **loop-friendly**, same fixture as 01.

## Flagship capture checklist

Before adding **01**:

- [ ] Fixture is **`canonical_v15_append_heavy.glass_pack`** (or dev `?fixture=flagship`).
- [ ] Window wide enough to show **scene** + at least one **trust** block (evidence or claims).
- [ ] No **file paths** to user home dirs unless fixture-relative and intentional.
- [ ] **1280×720** or **1920×1080** minimum; PNG or WebP; **sRGB**.

## Quality / safety

- Prefer **synthetic** packs over production captures.
- **Redact** hostnames, tokens, bearer strings, clipboard JSON if it contains session identifiers.
- Live captures: loopback URLs only; blur **session id** field if shown in logs.

## Not doing

- No **fake** graphs or invented topology overlays.
- No **stock** imagery passed off as Glass UI.

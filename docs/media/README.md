# Release media (screenshots / GIFs)

**Optional.** Nothing here is required to build, test, or run Glass.

## Regenerating captures

With the viewer dev server running (`npm run dev` in `viewer/`), from `viewer/`:

```bash
npx playwright install chromium
npm run capture:showcase-media -- http://127.0.0.1:5173
```

Use the port Vite prints (defaults to `5173` if free). Outputs **`01`–`04`** PNGs in this folder (`1280×720` viewport; **`01`** is full-page). The capture script now jumps replay to the strong end of the flagship pack, grabs the receipt from **Technical**, and keeps live in honest setup mode until data exists.

## Committed assets (README)

These **PNG** files are checked in for the bounded showcase path (see root **README**):

| File | Content |
|------|---------|
| `01-replay-flagship-overview.png` | Replay Overview at the strong end of **`?fixture=flagship`** — scene, evidence, claim, receipt, and time context in one frame. |
| `02-claim-chain-receipt.png` | Selected claim + receipt panel (`glass.receipt.v0`) from **Technical**. |
| `03-temporal-lens-compare.png` | Temporal lens region (bounded compare baseline). |
| `04-live-shell-overview.png` | **`?live=1`** shell in honest local setup mode — no fake claim/receipt before live data. |

**GIF (optional, not committed):** `05-replay-scrub-flagship.gif` — short scrub; keep **under ~15s**, same fixture as 01.

## Ordered assets (preferred filenames)

Use this **order** when embedding in README or release notes (flagship story first):

| # | Filename | What it must show |
|---|----------|-------------------|
| 01 | `01-replay-flagship-overview.png` | **Static replay** with **`canonical_v15_append_heavy.glass_pack`** loaded near the end of the pack: scene canvas plus the strongest honest evidence / claim / time context scan. |
| 02 | `02-claim-chain-receipt.png` | **Claim chip** selected with **receipt** detail visible (show some **glass.receipt.v0** structure) so the chain reaches the actual receipt. |
| 03 | `03-temporal-lens-compare.png` | **Temporal lens** + compare baseline context (replay) — shows **change** step is bounded, not a full timeline. |
| 04 | `04-live-shell-overview.png` | **`?live=1`** — bridge form + bounded visual surface in setup-first mode; **no** tokens, **no** secrets in frame. |

## Flagship capture checklist

Before replacing **01**:

- [ ] Fixture is **`canonical_v15_append_heavy.glass_pack`** (or dev `?fixture=flagship`).
- [ ] Replay is not on the first idle frame; move to a strong late-pack state before capturing.
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

# Release media (motion / screenshots / social preview)

**Optional.** Nothing here is required to build, test, or run Glass.

## Regenerating captures

With the viewer dev server running (`npm run dev` in `viewer/`), from `viewer/`:

```bash
npx playwright install chromium
npm run capture:showcase-media -- http://127.0.0.1:5173
```

Use the port Vite prints (defaults to `5173` if free). Outputs committed showcase assets in this folder: the flagship replay **GIF**, the replay/live **PNGs**, and the static **social preview** image. Motion and social-preview generation use `viewer/scripts/buildShowcaseMediaArt.py`, so have Python 3 with Pillow available in addition to Playwright.

## Committed assets (README)

These assets are checked in for the bounded showcase path (see root **README**):

| File | Content |
|------|---------|
| `00-flagship-replay-motion.gif` | Short replay motion from the real flagship surface, stepping through the bounded claim chain without fake overlays. |
| `01-replay-flagship-overview.png` | Replay Overview at the strong end of **`?fixture=flagship`** — scene, evidence, claim, receipt, and time context in one frame. |
| `02-claim-chain-receipt.png` | Selected claim + receipt panel (`glass.receipt.v0`) from **Technical**. |
| `03-temporal-lens-compare.png` | Temporal lens region (bounded compare baseline). |
| `04-live-shell-overview.png` | **`?live=1`** shell in honest local setup mode — no fake claim/receipt before live data. |
| `social-preview.png` | Share card built from the real replay screenshot plus narrow product framing. |

## Ordered assets (preferred filenames)

Use this **order** when embedding in README or release notes (flagship story first):

| # | Filename | What it must show |
|---|----------|-------------------|
| 00 | `00-flagship-replay-motion.gif` | **Short flagship replay motion** from the real viewer surface; replay stays authoritative and calm. |
| 01 | `01-replay-flagship-overview.png` | **Static replay** with **`canonical_v15_append_heavy.glass_pack`** loaded near the end of the pack: scene canvas plus the strongest honest evidence / claim / time context scan. |
| 02 | `02-claim-chain-receipt.png` | **Claim chip** selected with **receipt** detail visible (show some **glass.receipt.v0** structure) so the chain reaches the actual receipt. |
| 03 | `03-temporal-lens-compare.png` | **Temporal lens** + compare baseline context (replay) — shows **change** step is bounded, not a full timeline. |
| 04 | `04-live-shell-overview.png` | **`?live=1`** — bridge form + bounded visual surface in setup-first mode; **no** tokens, **no** secrets in frame. |

## Flagship capture checklist

Before replacing **00** or **01**:

- [ ] Fixture is **`canonical_v15_append_heavy.glass_pack`** (or dev `?fixture=flagship`).
- [ ] Replay motion uses real replay steps only; no fake transitions or overlays.
- [ ] Replay still is not on the first idle frame; move to a strong late-pack state before capturing.
- [ ] Window wide enough to show **scene** + at least one **trust** block (evidence or claims).
- [ ] No **file paths** to user home dirs unless fixture-relative and intentional.
- [ ] **1280×720** or **1920×1080** minimum for source captures; **sRGB**.

## Quality / safety

- Prefer **synthetic** packs over production captures.
- **Redact** hostnames, tokens, bearer strings, clipboard JSON if it contains session identifiers.
- Live captures: loopback URLs only; blur **session id** field if shown in logs.
- Social preview copy should stay narrow: replay-first, bounded, no generic observability claims.

## Not doing

- No **fake** graphs or invented topology overlays.
- No **stock** imagery passed off as Glass UI.

/**
 * Glass Vertical Slice v0 — one bounded demo scenario (copy + doc anchors only).
 * Not a wire protocol ID; does not assert extra telemetry beyond existing Scene v0 honesty.
 */

export const VERTICAL_SLICE_V0_ID = "glass.vertical_slice.v0" as const;

/**
 * Vertical Slice v18 — flagship bounded demo (Tier B, same compilers as the suite).
 * Append-heavy prefix: deep cursor, append semantics, rich tail for compare / evidence / claims / temporal lens.
 */
export const VERTICAL_SLICE_FLAGSHIP_V18_SESSION_ID = "canonical_v15_append_heavy" as const;

export const VERTICAL_SLICE_FLAGSHIP_V18_PACK_FILE = "canonical_v15_append_heavy.glass_pack" as const;

/** Dev server: `npm run dev` + this query loads the flagship bytes from the repo fixture (see devFixtureRoute). */
export const VERTICAL_SLICE_FLAGSHIP_V18_DEV_QUERY_HINT = "?fixture=flagship" as const;

export const VERTICAL_SLICE_FLAGSHIP_V18_TITLE = "Flagship bounded demo";

export const VERTICAL_SLICE_FLAGSHIP_V18_BODY =
  "Primary product path: the canonical append-heavy pack (14× process_poll_sample, session canonical_v15_append_heavy). It exercises append wire mode late in the prefix, replay-prefix honesty, bounded compare growth, evidence tail rows, episodes, receipts, and the temporal lens — more depth than the minimal vertical_slice_v0 smoke pack (3 events), without a second compiler or lane.";

/**
 * Single scenario: honest bounded operator visibility (replace / append / resync on one strip).
 * Not topology, not full history — same story as Scene v0 + Drawable Primitives v0.
 */
export const VERTICAL_SLICE_SCENARIO_TITLE = "Bounded operator visibility";

/**
 * Demo label only — same bounded strip as everywhere else; not a separate lane or storyboard telemetry.
 * Maps to the “agent goes rogue” narrative as *expectations vs honest bounds*, not a fake graph.
 */
export const VERTICAL_SLICE_SCENARIO_LABEL = "Agent expectations vs honest bounds";

export const VERTICAL_SLICE_SCENARIO_BODY =
  "One path: the same Glass Scene System v0 strip and Drawable Primitives semantics in replay (index-ordered prefix from a pack) and in live (bounded WebSocket tail + optional HTTP reconcile). Wire-mode slots are real roles — not a process graph or invented continuity.";

export function replayHeroSubtitle(): string {
  return "Tier B static replay stays the default surface. Start with the flagship append-heavy pack for the full bounded story (compare, evidence, claims, temporal lens). Minimal smoke: tests/fixtures/vertical_slice_v0/ Tier B (3 events) for fast CI; canonical suite packs prove breadth (replace, calm, file-heavy).";
}

export function liveHeroSubtitle(): string {
  return "Same strip, selection, compare, evidence, claims, and episodes as replay — driven by the bounded WS tail + HTTP snapshot. The flagship replay path (append-heavy canonical) defines the vocabulary; live proves the same surfaces under wire deltas.";
}

/**
 * Vertical Slice v20 — external-style audit: one explicit reading order reduces first-run “internal tool” confusion.
 * Not a workflow engine — copy only.
 */
export const VERTICAL_SLICE_V20_READING_ORDER_REPLAY =
  "Suggested scan: scene canvas → bounded evidence (scope + rows) → episode cards → claim chips → receipt → temporal lens (compare baseline). Replay uses an index-ordered pack prefix; receipts/evidence are viewer-derived from bounded frames — not collector certificates.";

export const VERTICAL_SLICE_V20_READING_ORDER_LIVE =
  "Suggested scan: scene → bounded evidence → episodes → claims → receipt → temporal lens. WS tail + HTTP snapshot are distinct inputs — not one merged history; same trust surfaces as replay.";

/** Shown when receipt is empty after a temporal compare-baseline override (v19/v20 handoff). */
export const RECEIPT_EMPTY_SUPPLEMENT_AFTER_TEMPORAL_BASELINE =
  "Compare baseline changed: scrub/step or play (replay), or wait for the next live frame, to restore suggested claim highlighting — or select a claim chip explicitly.";

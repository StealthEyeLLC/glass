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

/**
 * Vertical Slice v26 — first-run hero lead: what to do, not how the dev server is launched.
 * Technical fixture paths live in `replayHeroSubtitleTechnical()` / README / collapsible UI.
 */
export const VERTICAL_SLICE_V26_REPLAY_HERO_LEAD =
  "Tier B static replay is the default surface. Open the flagship append-heavy pack for the full bounded story — compare, evidence, claims, receipt, temporal lens. Minimal smoke packs and breadth scenarios stay in-repo for CI; you do not need them for a first read.";

/** Checkout-relative paths, CI roles, and dev auto-load — for advanced/docs only. */
export function replayHeroSubtitleTechnical(): string {
  return "Minimal smoke: tests/fixtures/vertical_slice_v0/ Tier B (3 events) for fast CI. Canonical suite packs under tests/fixtures/canonical_scenarios_v15/ prove breadth (replace, calm, file-heavy). Development: npm run dev with ?fixture=flagship loads the flagship bytes without picking a path from disk.";
}

export function replayHeroSubtitle(): string {
  return VERTICAL_SLICE_V26_REPLAY_HERO_LEAD;
}

/** Flagship callout — one sentence for scanning; no npm/query in the primary line. */
export const VERTICAL_SLICE_V26_FLAGSHIP_EASY_SUMMARY =
  "The flagship pack is committed in this repo — use Open file, or Load flagship demo when running the dev build.";

/** One paragraph for collapsible “technical” on replay + README-adjacent honesty. */
export const VERTICAL_SLICE_V26_LIVE_NAV_TECHNICAL =
  "Live mode is still local: this tab talks to a bridge on your machine (not a hosted cloud). The viewer adds a query flag to switch shells; connection fields stay under Connection settings.";

/** Live shell — honest local scope without surfacing ports or URLs in the primary paragraph. */
export const VERTICAL_SLICE_V26_LIVE_INTRO_HONEST =
  "Live mode runs in this browser against a bridge on your machine — not a hosted Glass service. Expand Connection settings when you have a loopback URL, bearer token, and session id; bounded replay (default) needs no bridge.";

export function liveHeroSubtitle(): string {
  return "Same strip, selection, compare, evidence, claims, and episodes as replay — driven by the bounded WebSocket tail and HTTP snapshot. The flagship replay path (append-heavy canonical) defines the vocabulary; live proves the same surfaces under wire deltas.";
}

/** Freeze-candidate product framing — use sparingly (README, flagship callout, reading order). */
export const GLASS_FLAGSHIP_CHAIN_ONE_LINER =
  "Glass turns bounded runtime activity into an inspectable claim chain: scene, change, evidence, receipt." as const;

export const GLASS_FLAGSHIP_CHAIN_DOC =
  "Glass lets you move from bounded scene state, to what changed, to supporting evidence, to the exact bounded claim you can make — without pretending to know more than it does." as const;

/**
 * Vertical Slice v20 — external-style audit: one explicit reading order reduces first-run “internal tool” confusion.
 * Not a workflow engine — copy only. v21 weaves in freeze-candidate flagship framing (scene → change → evidence → receipt).
 */
export const VERTICAL_SLICE_V20_READING_ORDER_REPLAY =
  `${GLASS_FLAGSHIP_CHAIN_ONE_LINER} Suggested scan: scene canvas → bounded evidence (scope + rows) → episode cards → claim chips → receipt → temporal lens (compare baseline). Replay uses an index-ordered pack prefix; receipts/evidence are viewer-derived from bounded frames — not collector certificates.`;

export const VERTICAL_SLICE_V20_READING_ORDER_LIVE =
  `${GLASS_FLAGSHIP_CHAIN_ONE_LINER} Suggested scan: scene → bounded evidence → episodes → claims → receipt → temporal lens. WS tail + HTTP snapshot are distinct inputs — not one merged history; same trust surfaces as replay.`;

/** Shown when receipt is empty after a temporal compare-baseline override (v19/v20 handoff). */
export const RECEIPT_EMPTY_SUPPLEMENT_AFTER_TEMPORAL_BASELINE =
  "Compare baseline changed: scrub/step or play (replay), or wait for the next live frame, to restore suggested claim highlighting — or select a claim chip explicitly.";

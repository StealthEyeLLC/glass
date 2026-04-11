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

/** Technical / docs — full flagship path description (details layer). */
export const VERTICAL_SLICE_FLAGSHIP_V18_TITLE = "Flagship bounded demo";

export const VERTICAL_SLICE_FLAGSHIP_V18_BODY =
  "Primary product path: the canonical append-heavy pack (14× process_poll_sample, session canonical_v15_append_heavy). It exercises append wire mode late in the prefix, replay-prefix honesty, bounded compare growth, evidence tail rows, episodes, receipts, and the temporal lens — more depth than the minimal vertical_slice_v0 smoke pack (3 events), without a second compiler or lane.";

/** Vertical Slice v27 — simple flagship surface (default visible copy). */
export const VERTICAL_SLICE_V27_FLAGSHIP_TITLE_SIMPLE = "Flagship session";

export const VERTICAL_SLICE_V27_FLAGSHIP_BODY_SIMPLE =
  "The deep demo pack in this repo: many process samples, rich compare, evidence rows, story cards, claims, receipt, and time context — one file, full story.";

/**
 * Single scenario: honest bounded operator visibility (replace / append / resync on one strip).
 * Not topology, not full history — same story as Scene System v0 + Drawable Primitives v0.
 */
export const VERTICAL_SLICE_SCENARIO_TITLE = "Bounded operator visibility";

/** Vertical Slice v27 — plain-language scenario (default layer). */
export const VERTICAL_SLICE_V27_SCENARIO_TITLE_SIMPLE = "What this view is for";

/**
 * Demo label only — same bounded strip as everywhere else; not a separate lane or storyboard telemetry.
 * Maps to the “agent goes rogue” narrative as *expectations vs honest bounds*, not a fake graph.
 */
export const VERTICAL_SLICE_SCENARIO_LABEL = "Agent expectations vs honest bounds";

export const VERTICAL_SLICE_V27_SCENARIO_LABEL_SIMPLE = "Expectations vs what the data actually shows";

export const VERTICAL_SLICE_SCENARIO_BODY =
  "One path: the same Glass Scene System v0 strip and Drawable Primitives semantics in replay (index-ordered prefix from a pack) and in live (bounded WebSocket tail + optional HTTP reconcile). Wire-mode slots are real roles — not a process graph or invented continuity.";

export const VERTICAL_SLICE_V27_SCENARIO_BODY_SIMPLE =
  "One path: the same on-screen strip in replay (saved session file) and live (what the bridge is sending now). Slots show real roles — not a drawn process graph or invented history.";

/**
 * Vertical Slice v26 — first-run hero lead: what to do, not how the dev server is launched.
 * Technical fixture paths live in `replayHeroSubtitleTechnical()` / README / collapsible UI.
 */
export const VERTICAL_SLICE_V26_REPLAY_HERO_LEAD =
  "Tier B static replay is the default surface. Open the flagship append-heavy pack for the full bounded story — compare, evidence, claims, receipt, temporal lens. Minimal smoke packs and breadth scenarios stay in-repo for CI; you do not need them for a first read.";

/** Vertical Slice v27 — default hero subtitle (plain language). */
export const VERTICAL_SLICE_V27_REPLAY_HERO_LEAD =
  "Open the flagship demo pack to walk scene → what changed → evidence → claim → receipt. Other packs in the repo are for breadth checks; you can ignore them for a first read.";

/** Vertical Slice v28 — first visible hero line only (one short sentence). */
export const VERTICAL_SLICE_V28_REPLAY_HERO_LEAD = "Load the flagship pack below.";

/** Vertical Slice v28 — reading-order hint inside collapsed details (not the v27 paragraph on screen). */
export const VERTICAL_SLICE_V28_READING_ORDER_REPLAY_MICRO =
  "Scene → change → evidence → claims → receipt → time.";

/** Vertical Slice v28 — live reading-order micro (inside collapsed details). */
export const VERTICAL_SLICE_V28_READING_ORDER_LIVE_MICRO =
  "Scene → evidence → claims → receipt → time.";

/** Vertical Slice v28 — live hero: one short line; longer copy in details. */
export const VERTICAL_SLICE_V28_LIVE_HERO_LEAD = "Same panels as replay — connect below.";

/** Vertical Slice v28 — evidence panel lead (minimum words). */
export const VERTICAL_SLICE_V28_EVIDENCE_LEAD = "From this step — not the whole machine.";

/** Vertical Slice v30 — Overview surface: scene strip caption without compiler jargon. */
export const VERTICAL_SLICE_V30_SCENE_NOTE_OVERVIEW =
  "What you see reflects the session so far — not the full machine or live feed.";

/**
 * Vertical Slice v31 — Overview default surface: one calm line under primary actions (idle).
 */
export const VERTICAL_SLICE_V31_REPLAY_OVERVIEW_HELPER =
  "Load a session to see what changed, the evidence behind it, and what Glass can claim.";

/** v31 — Scene (Overview): one short line, no topology or feed jargon. */
export const VERTICAL_SLICE_V31_SCENE_NOTE_OVERVIEW = "What you see is the session so far.";

/** v31 — Evidence lead (Overview). */
export const VERTICAL_SLICE_V31_EVIDENCE_LEAD_OVERVIEW = "What Glass is using right now.";

/** v31 — Evidence empty (Overview). */
export const VERTICAL_SLICE_V31_EVIDENCE_EMPTY_OVERVIEW = "No evidence to show yet.";

/** v31 — Claim lead (Overview). */
export const VERTICAL_SLICE_V31_CLAIM_LEAD_OVERVIEW = "What Glass can support from this view.";

/** v31 — Claim / receipt empty (Overview). */
export const VERTICAL_SLICE_V31_CLAIM_EMPTY_OVERVIEW = "Glass cannot make a strong claim yet.";

/** v31 — Episodes empty (Overview). */
export const VERTICAL_SLICE_V31_EPISODES_EMPTY_OVERVIEW = "Nothing notable yet.";

/** Vertical Slice v30 — live visual block lead for Overview (no canvas/compiler wording). */
export const VERTICAL_SLICE_V30_LIVE_VISUAL_INTRO_OVERVIEW =
  "Same strip as replay: scene, evidence, claims, receipt, and time.";

/** v31 — live Scene block lead (Overview); matches replay spirit. */
export const VERTICAL_SLICE_V31_LIVE_VISUAL_INTRO_OVERVIEW = VERTICAL_SLICE_V31_SCENE_NOTE_OVERVIEW;

/** Vertical Slice v28 — receipt empty (minimum words). */
export const VERTICAL_SLICE_V28_RECEIPT_EMPTY = "Pick a claim or story card.";

/** Checkout-relative paths, CI roles, and dev auto-load — for advanced/docs only. */
export function replayHeroSubtitleTechnical(): string {
  return "Minimal smoke: tests/fixtures/vertical_slice_v0/ Tier B (3 events) for fast CI. Canonical suite packs under tests/fixtures/canonical_scenarios_v15/ prove breadth (replace, calm, file-heavy). Development: npm run dev with ?fixture=flagship loads the flagship bytes without picking a path from disk.";
}

export function replayHeroSubtitle(): string {
  return VERTICAL_SLICE_V28_REPLAY_HERO_LEAD;
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
  return VERTICAL_SLICE_V28_LIVE_HERO_LEAD;
}

export const VERTICAL_SLICE_V27_LIVE_HERO_LEAD =
  "Same surfaces as replay — driven by the live feed and the snapshot the bridge returns. The flagship replay pack defines the vocabulary; live shows the same trust panels under real wire updates.";

/** Live shell — short line tying panels to the flagship replay vocabulary (default layer). */
export const VERTICAL_SLICE_V27_LIVE_FLAGSHIP_NOTE_SIMPLE =
  "Replay and live share the same panels — the flagship replay pack in the repo is the vocabulary reference.";

/** Freeze-candidate product framing — use sparingly (README, flagship callout, reading order). */
export const GLASS_FLAGSHIP_CHAIN_ONE_LINER =
  "Glass turns bounded runtime activity into an inspectable claim chain: scene, change, evidence, receipt." as const;

export const GLASS_FLAGSHIP_CHAIN_DOC =
  "Glass lets you move from bounded scene state, to what changed, to supporting evidence, to the exact bounded claim you can make — without pretending to know more than it does." as const;

/** Vertical Slice v27 — one short framing line for the default callout (not slogan-spam). */
export const VERTICAL_SLICE_V27_FLAGSHIP_FRAMING_SIMPLE =
  "Glass walks from what you see, to what changed, to supporting rows, to what you can honestly claim — without extra theater.";

/**
 * Vertical Slice v20 — external-style audit: one explicit reading order reduces first-run “internal tool” confusion.
 * Not a workflow engine — copy only. v21 weaves in freeze-candidate flagship framing (scene → change → evidence → receipt).
 * v27: split into simple + technical; `VERTICAL_SLICE_V20_READING_ORDER_REPLAY` points at the technical layer for tests.
 */
export const VERTICAL_SLICE_V27_READING_ORDER_REPLAY_SIMPLE =
  "Suggested scan: scene → what changed → evidence → story cards → claims → receipt → time context. Everything is based on the events loaded up to your current replay step — not the whole system, not a collector certificate.";

export const VERTICAL_SLICE_V27_READING_ORDER_REPLAY_TECHNICAL = `${GLASS_FLAGSHIP_CHAIN_ONE_LINER} Suggested scan: scene canvas → bounded evidence (scope + rows) → episode cards → claim chips → receipt → temporal lens (compare baseline). Replay uses an index-ordered pack prefix; receipts/evidence are viewer-derived from bounded frames — not collector certificates.`;

/** @deprecated Prefer `VERTICAL_SLICE_V27_READING_ORDER_REPLAY_TECHNICAL` — retained for tests expecting v20 string. */
export const VERTICAL_SLICE_V20_READING_ORDER_REPLAY =
  VERTICAL_SLICE_V27_READING_ORDER_REPLAY_TECHNICAL;

export const VERTICAL_SLICE_V27_READING_ORDER_LIVE_SIMPLE =
  "Suggested scan: scene → what changed → evidence → story cards → claims → receipt → time context. Live feed and HTTP snapshot stay separate inputs — not one merged history.";

export const VERTICAL_SLICE_V27_READING_ORDER_LIVE_TECHNICAL = `${GLASS_FLAGSHIP_CHAIN_ONE_LINER} Suggested scan: scene → bounded evidence → episodes → claims → receipt → temporal lens. WS tail + HTTP snapshot are distinct inputs — not one merged history; same trust surfaces as replay.`;

/** @deprecated Prefer `VERTICAL_SLICE_V27_READING_ORDER_LIVE_TECHNICAL`. */
export const VERTICAL_SLICE_V20_READING_ORDER_LIVE = VERTICAL_SLICE_V27_READING_ORDER_LIVE_TECHNICAL;

/** Shown when receipt is empty after a temporal compare-baseline override (v19/v20 handoff). */
export const RECEIPT_EMPTY_SUPPLEMENT_AFTER_TEMPORAL_BASELINE =
  "The compare baseline just moved — scrub or play a step to refresh suggested highlights, or pick a claim explicitly.";

/** Receipt panel — empty state (simple layer); v28 short wording. */
export const VERTICAL_SLICE_V27_RECEIPT_EMPTY_SIMPLE = VERTICAL_SLICE_V28_RECEIPT_EMPTY;

/** Evidence panel — first line (simple layer). */
export const VERTICAL_SLICE_V27_EVIDENCE_LEAD =
  "Rows and facts here match what you’ve stepped through in this view — not the whole machine.";

/**
 * Glass Vertical Slice v0 — one bounded demo scenario (copy + doc anchors only).
 * Not a wire protocol ID; does not assert extra telemetry beyond existing Scene v0 honesty.
 */

export const VERTICAL_SLICE_V0_ID = "glass.vertical_slice.v0" as const;

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
  return "Tier B static replay — Vertical Slice v0. static replay remains the default surface; load a .glass_pack and scrub to see prefix depth and R/A/Rz emphasis on the strip.";
}

export function liveHeroSubtitle(): string {
  return "Live session — same strip as replay, driven by the bounded WS tail and HTTP snapshot. WebGPU geometry + Canvas labels when available.";
}

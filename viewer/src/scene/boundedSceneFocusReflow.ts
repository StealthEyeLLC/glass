/**
 * Vertical Slice v7 — bounded focus **reflow**: selection reshapes strip **layout** (heights, lane widths),
 * not just tint/dim. Pure, deterministic, grouping-only — no graph traversal.
 */

import { LIVE_VISUAL_BAND_LAYOUT } from "../live/liveVisualMarkers.js";
import type { GlassSceneV0, SceneBoundedRegionRole } from "./glassSceneV0.js";
import type { BoundedSceneFocusV0 } from "./boundedSceneFocus.js";

/** Matches `LIVE_VISUAL_STATE_RAIL_LAYOUT` / `LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT` in drawablePrimitivesV0. */
const CLUSTER_STRIP_INSET_X = 16;

export const BOUNDED_STRIP_LAYOUT_KIND = "glass.strip_layout.v0" as const;

export interface BoundedStripLayoutV0 {
  kind: typeof BOUNDED_STRIP_LAYOUT_KIND;
  /** True when any vertical measure differs from the idle strip (or lane weights are non-uniform). */
  reflowActive: boolean;
  primaryY: number;
  primaryH: number;
  gapPrimarySystem: number;
  systemY: number;
  systemH: number;
  gapSystemCluster: number;
  clusterY: number;
  clusterH: number;
  /** Live replay: three inner lane width fractions (snapshot / resync / warning). Sum 1. */
  stateRailLaneFractions: readonly [number, number, number] | null;
  /** One fraction per cluster lane; sum 1. null = equal split. */
  clusterLaneFractions: readonly number[] | null;
}

/** Idle strip — matches `LIVE_VISUAL_*` constants and legacy tests. */
export function defaultBoundedStripLayout(): BoundedStripLayoutV0 {
  const primaryY = LIVE_VISUAL_BAND_LAYOUT.originY;
  const primaryH = LIVE_VISUAL_BAND_LAYOUT.height;
  const gapPrimarySystem = 8;
  const systemY = 52;
  const systemH = 20;
  const gapSystemCluster = 2;
  const clusterY = 74;
  const clusterH = 22;
  return {
    kind: BOUNDED_STRIP_LAYOUT_KIND,
    reflowActive: false,
    primaryY,
    primaryH,
    gapPrimarySystem,
    systemY,
    systemH,
    gapSystemCluster,
    clusterY,
    clusterH,
    stateRailLaneFractions: null,
    clusterLaneFractions: null,
  };
}

function normalizeFracs3(a: number, b: number, c: number): readonly [number, number, number] {
  const s = a + b + c;
  if (s <= 0) {
    return [1 / 3, 1 / 3, 1 / 3];
  }
  return [a / s, b / s, c / s];
}

function clusterLaneFractionsForFocus(scene: GlassSceneV0, focus: BoundedSceneFocusV0): readonly number[] | null {
  if (!focus.focusedClusterId || scene.clusters.length <= 1) {
    return null;
  }
  const idx = scene.clusters.findIndex((c) => c.id === focus.focusedClusterId);
  if (idx < 0) {
    return null;
  }
  const n = scene.clusters.length;
  const focused = 0.42;
  const rest = (1 - focused) / (n - 1);
  return scene.clusters.map((_, i) => (i === idx ? focused : rest));
}

function stateRailFractionsFromSelection(selectedId: string | null): readonly [number, number, number] | null {
  if (!selectedId || !selectedId.includes(":state_rail:lane:")) {
    return null;
  }
  if (selectedId.includes(":lane:snapshot")) {
    return normalizeFracs3(0.46, 0.27, 0.27);
  }
  if (selectedId.includes(":lane:resync")) {
    return normalizeFracs3(0.27, 0.46, 0.27);
  }
  if (selectedId.includes(":lane:warning")) {
    return normalizeFracs3(0.27, 0.27, 0.46);
  }
  return null;
}

/**
 * Pure layout from focus + scene. When `focus.active` is false, returns the default strip.
 */
export function computeBoundedStripLayoutFromFocus(
  scene: GlassSceneV0,
  focus: BoundedSceneFocusV0,
  selectedId: string | null,
): BoundedStripLayoutV0 {
  const base = defaultBoundedStripLayout();
  if (!focus.active) {
    return base;
  }

  const primaryY = base.primaryY;
  let primaryH = base.primaryH;
  let gapPS = base.gapPrimarySystem;
  let systemH = base.systemH;
  const gapSC = base.gapSystemCluster;
  let clusterH = base.clusterH;

  const band = focus.emphasizedVerticalBand;
  const railFr = stateRailFractionsFromSelection(selectedId);

  if (band === "primary_wire") {
    primaryH += 8;
    systemH -= 4;
    clusterH -= 4;
    gapPS = Math.max(4, gapPS - 2);
  } else if (band === "system_rail") {
    primaryH -= 4;
    systemH += 10;
    clusterH -= 4;
  } else if (band === "evidence_strip" || focus.focusedClusterId) {
    primaryH -= 4;
    systemH -= 4;
    clusterH += 10;
    gapPS = Math.max(5, gapPS - 2);
  }

  const systemY = primaryY + primaryH + gapPS;
  const clusterY = systemY + systemH + gapSC;

  const clusterFr = clusterLaneFractionsForFocus(scene, focus);
  const reflowActive =
    primaryH !== base.primaryH ||
    systemH !== base.systemH ||
    clusterH !== base.clusterH ||
    gapPS !== base.gapPrimarySystem ||
    railFr !== null ||
    clusterFr !== null;

  return {
    kind: BOUNDED_STRIP_LAYOUT_KIND,
    reflowActive,
    primaryY,
    primaryH,
    gapPrimarySystem: gapPS,
    systemY,
    systemH,
    gapSystemCluster: gapSC,
    clusterY,
    clusterH,
    stateRailLaneFractions: railFr,
    clusterLaneFractions: clusterFr,
  };
}

/** One-line caption fragment for overlay / provenance (honest layout deltas). */
export function formatBoundedStripReflowSummary(layout: BoundedStripLayoutV0): string | null {
  if (!layout.reflowActive) {
    return null;
  }
  const parts: string[] = [];
  parts.push(`wire ${layout.primaryH}px`);
  parts.push(`rail ${layout.systemH}px`);
  parts.push(`lanes ${layout.clusterH}px`);
  if (layout.clusterLaneFractions) {
    parts.push("weighted cluster widths");
  }
  if (layout.stateRailLaneFractions) {
    parts.push("rail lane emphasis");
  }
  return parts.join(" · ");
}

export function clusterSegmentBoundsFromLayout(
  scene: GlassSceneV0,
  clusterIndex: number,
  widthCss: number,
  layout: BoundedStripLayoutV0,
): { x: number; y: number; width: number; height: number } | null {
  const clusters = scene.clusters;
  if (clusterIndex < 0 || clusterIndex >= clusters.length) {
    return null;
  }
  const inset = CLUSTER_STRIP_INSET_X;
  const y = layout.clusterY;
  const h = layout.clusterH;
  const innerW = widthCss - 2 * inset;
  const pad = 2;
  const gap = 2;
  const n = clusters.length;
  const innerW2 = innerW - 2 * pad;
  const fr = layout.clusterLaneFractions;
  let segWidths: number[];
  if (fr && fr.length === n) {
    const innerTracks = innerW2 - (n - 1) * gap;
    segWidths = fr.map((f) => innerTracks * f);
  } else {
    const segW = (innerW2 - (n - 1) * gap) / n;
    segWidths = clusters.map(() => segW);
  }
  const innerY = y + pad;
  const innerH = h - 2 * pad;
  let x = inset + pad;
  for (let i = 0; i < clusterIndex; i++) {
    const wPrev = segWidths[i];
    if (wPrev === undefined) {
      return null;
    }
    x += wPrev + gap;
  }
  const wSeg = segWidths[clusterIndex];
  if (wSeg === undefined) {
    return null;
  }
  return { x, y: innerY, width: wSeg, height: innerH };
}

export function focusRectForRegionRoleWithLayout(
  scene: GlassSceneV0,
  role: SceneBoundedRegionRole,
  widthCss: number,
  layout: BoundedStripLayoutV0,
): { x: number; y: number; width: number; height: number } | null {
  if (scene.regions.length === 0) {
    return null;
  }
  const inset = 16;
  const innerW = widthCss - 2 * inset;
  switch (role) {
    case "primary_wire_sample":
      return {
        x: inset,
        y: layout.primaryY,
        width: innerW,
        height: layout.primaryH,
      };
    case "system_integrity_rail":
      return {
        x: inset,
        y: layout.systemY,
        width: innerW,
        height: layout.systemH,
      };
    case "bounded_sample_evidence":
      return {
        x: inset,
        y: layout.clusterY,
        width: innerW,
        height: layout.clusterH,
      };
    default:
      return null;
  }
}

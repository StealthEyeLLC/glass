/**
 * Vertical Slice v8 — bounded scene compare (pure, deterministic).
 * Compares only real prior vs current bounded snapshots — no inferred topology or invented history.
 */

import { buildLiveVisualMarkersLayout } from "../live/liveVisualMarkers.js";
import {
  LIVE_VISUAL_STATE_RAIL_LAYOUT,
  type DrawablePrimitiveSemanticTag,
} from "./drawablePrimitivesV0.js";
import { computeBoundedSceneFocus } from "./boundedSceneFocus.js";
import {
  clusterSegmentBoundsFromLayout,
  type BoundedStripLayoutV0,
} from "./boundedSceneFocusReflow.js";
import type { GlassSceneV0, SceneActorCluster } from "./glassSceneV0.js";
import type { LiveVisualSpec } from "../live/liveVisualModel.js";

export const BOUNDED_SCENE_COMPARE_KIND = "glass.compare.v0" as const;

export interface BoundedSceneCompareHintsV0 {
  wireModeChanged: boolean;
  densityOrTailChanged: boolean;
  snapshotOriginChanged: boolean;
  reconcileChanged: boolean;
  resyncReasonChanged: boolean;
  warningChanged: boolean;
  replayPrefixChanged: boolean;
  railSignalsChanged: boolean;
  clusterIdsWithBoundedDelta: readonly string[];
  regionWeightsChanged: boolean;
  emphasisStepsChanged: boolean;
  focusTargetChanged: boolean;
}

export interface BoundedSceneCompareV0 {
  kind: typeof BOUNDED_SCENE_COMPARE_KIND;
  available: boolean;
  unavailableReason: string | null;
  /** One line for overlay / provenance; null when no prior frame. */
  summaryLine: string | null;
  /** Extra lines for inspector / tests. */
  detailLines: readonly string[];
  hints: BoundedSceneCompareHintsV0;
  /** Selection-scoped line when the same bounded id exists on both sides; null otherwise. */
  selectionCompareLine: string | null;
}

function eqNullableString(a: string | null, b: string | null): boolean {
  return (a ?? "") === (b ?? "");
}

function eqNullableReplayPrefix(a: number | null, b: number | null): boolean {
  if (a === null && b === null) {
    return true;
  }
  if (a === null || b === null) {
    return false;
  }
  return Math.abs(a - b) < 1e-9;
}

function clusterFacts(c: SceneActorCluster): string {
  return `${c.lane}:${c.sampleCount}:${c.emphasis01.toFixed(3)}`;
}

function emphasisStepsSig(e: GlassSceneV0["emphasis"]): string {
  const x = e;
  return [
    x.wirePulseStep,
    x.samplePulseStep,
    x.resyncFlashStep,
    x.systemFlashStep,
    x.replayCursorPulseStep,
  ].join(":");
}

function regionWeightsSig(e: GlassSceneV0["emphasis"]): string {
  return [
    e.regionWeightPrimary.toFixed(3),
    e.regionWeightSystem.toFixed(3),
    e.regionWeightEvidence.toFixed(3),
  ].join(":");
}

function unionClusterIds(a: GlassSceneV0, b: GlassSceneV0): Set<string> {
  const s = new Set<string>();
  for (const c of a.clusters) {
    s.add(c.id);
  }
  for (const c of b.clusters) {
    s.add(c.id);
  }
  return s;
}

function clusterById(scene: GlassSceneV0, id: string): SceneActorCluster | undefined {
  return scene.clusters.find((c) => c.id === id);
}

function formatSelectionCompareLine(
  prev: GlassSceneV0,
  next: GlassSceneV0,
  selectedId: string | null,
): string | null {
  if (!selectedId || selectedId.length === 0) {
    return null;
  }
  const prefix = "glass.sel.v0:cluster:";
  if (!selectedId.startsWith(prefix)) {
    return null;
  }
  const cid = selectedId.slice(prefix.length);
  const pc = clusterById(prev, cid);
  const nc = clusterById(next, cid);
  if (pc && nc) {
    if (clusterFacts(pc) !== clusterFacts(nc)) {
      return `selected cluster ${cid}: ${clusterFacts(pc)} → ${clusterFacts(nc)}`;
    }
    return null;
  }
  if (!pc && nc) {
    return `selected cluster ${cid}: appeared in bounded sample`;
  }
  if (pc && !nc) {
    return `selected cluster ${cid}: not in current bounded sample`;
  }
  return null;
}

export interface ComputeBoundedSceneCompareOptions {
  selectedId: string | null;
}

/**
 * Pure compare of two bounded scenes. `prev` must be the immediately prior painted/compiled frame
 * for honest replay/live stepping; when null, compare is unavailable.
 */
export function computeBoundedSceneCompare(
  prev: GlassSceneV0 | null,
  next: GlassSceneV0,
  options: ComputeBoundedSceneCompareOptions,
): BoundedSceneCompareV0 {
  const selectedId = options.selectedId ?? null;
  if (prev === null) {
    return {
      kind: BOUNDED_SCENE_COMPARE_KIND,
      available: false,
      unavailableReason: "No prior bounded frame on this path yet.",
      summaryLine: null,
      detailLines: [],
      hints: {
        wireModeChanged: false,
        densityOrTailChanged: false,
        snapshotOriginChanged: false,
        reconcileChanged: false,
        resyncReasonChanged: false,
        warningChanged: false,
        replayPrefixChanged: false,
        railSignalsChanged: false,
        clusterIdsWithBoundedDelta: [],
        regionWeightsChanged: false,
        emphasisStepsChanged: false,
        focusTargetChanged: false,
      },
      selectionCompareLine: null,
    };
  }

  const wireModeChanged = prev.wireMode !== next.wireMode;
  const densityOrTailChanged =
    prev.boundedSampleCount !== next.boundedSampleCount ||
    Math.abs(prev.density01 - next.density01) > 1e-6;
  const snapshotOriginChanged = !eqNullableString(
    prev.snapshotOriginLabel,
    next.snapshotOriginLabel,
  );
  const reconcileChanged = !eqNullableString(prev.reconcileSummary, next.reconcileSummary);
  const resyncReasonChanged = !eqNullableString(prev.resyncReason, next.resyncReason);
  const warningChanged = !eqNullableString(prev.warningCode, next.warningCode);
  const replayPrefixChanged = !eqNullableReplayPrefix(prev.replayPrefixFraction, next.replayPrefixFraction);
  const railSignalsChanged =
    snapshotOriginChanged || resyncReasonChanged || warningChanged || replayPrefixChanged;

  const clusterIdsWithBoundedDelta: string[] = [];
  for (const id of unionClusterIds(prev, next)) {
    const a = clusterById(prev, id);
    const b = clusterById(next, id);
    if (!a || !b) {
      clusterIdsWithBoundedDelta.push(id);
    } else if (clusterFacts(a) !== clusterFacts(b)) {
      clusterIdsWithBoundedDelta.push(id);
    }
  }
  clusterIdsWithBoundedDelta.sort();

  const regionWeightsChanged = regionWeightsSig(prev.emphasis) !== regionWeightsSig(next.emphasis);
  const emphasisStepsChanged = emphasisStepsSig(prev.emphasis) !== emphasisStepsSig(next.emphasis);

  const fp = computeBoundedSceneFocus(prev, selectedId);
  const fn = computeBoundedSceneFocus(next, selectedId);
  const focusTargetChanged =
    fp.captionLine !== fn.captionLine ||
    fp.provenanceFocusLine !== fn.provenanceFocusLine ||
    fp.focusedClusterId !== fn.focusedClusterId ||
    fp.focusedRegionId !== fn.focusedRegionId ||
    fp.emphasizedVerticalBand !== fn.emphasizedVerticalBand;

  const hints: BoundedSceneCompareHintsV0 = {
    wireModeChanged,
    densityOrTailChanged,
    snapshotOriginChanged,
    reconcileChanged,
    resyncReasonChanged,
    warningChanged,
    replayPrefixChanged,
    railSignalsChanged,
    clusterIdsWithBoundedDelta,
    regionWeightsChanged,
    emphasisStepsChanged,
    focusTargetChanged,
  };

  const parts: string[] = [];
  if (wireModeChanged) {
    parts.push(`wire ${prev.wireMode}→${next.wireMode}`);
  }
  if (densityOrTailChanged) {
    parts.push(`tail/samples ${prev.boundedSampleCount}→${next.boundedSampleCount}`);
  }
  if (snapshotOriginChanged) {
    parts.push("snapshot_origin label changed");
  }
  if (reconcileChanged) {
    parts.push("HTTP reconcile line changed");
  }
  if (resyncReasonChanged) {
    parts.push("resync reason changed");
  }
  if (warningChanged) {
    parts.push("warning code changed");
  }
  if (replayPrefixChanged) {
    parts.push("replay prefix fraction changed");
  }
  if (clusterIdsWithBoundedDelta.length > 0) {
    parts.push(`clusters touched: ${clusterIdsWithBoundedDelta.join(", ")}`);
  }
  if (regionWeightsChanged) {
    parts.push("region emphasis weights changed");
  }
  if (emphasisStepsChanged) {
    parts.push("emphasis pulse steps changed");
  }
  if (focusTargetChanged && selectedId) {
    parts.push("focus target/caption changed (for current selection)");
  }

  const detailLines: string[] = [];
  if (wireModeChanged) {
    detailLines.push(`Wire mode: ${prev.wireMode} → ${next.wireMode}`);
  }
  if (densityOrTailChanged) {
    detailLines.push(
      `Bounded tail/sample mass: ${prev.boundedSampleCount} → ${next.boundedSampleCount} (density ${prev.density01.toFixed(3)} → ${next.density01.toFixed(3)})`,
    );
  }
  if (snapshotOriginChanged) {
    detailLines.push(`snapshot_origin: ${prev.snapshotOriginLabel ?? "—"} → ${next.snapshotOriginLabel ?? "—"}`);
  }
  if (reconcileChanged) {
    detailLines.push(`HTTP reconcile: ${prev.reconcileSummary ?? "—"} → ${next.reconcileSummary ?? "—"}`);
  }
  if (resyncReasonChanged) {
    detailLines.push(`resync: ${prev.resyncReason ?? "—"} → ${next.resyncReason ?? "—"}`);
  }
  if (warningChanged) {
    detailLines.push(`warning: ${prev.warningCode ?? "—"} → ${next.warningCode ?? "—"}`);
  }
  if (replayPrefixChanged) {
    detailLines.push(
      `replay prefix: ${prev.replayPrefixFraction ?? "—"} → ${next.replayPrefixFraction ?? "—"}`,
    );
  }
  for (const cid of clusterIdsWithBoundedDelta) {
    const a = clusterById(prev, cid);
    const b = clusterById(next, cid);
    if (a && b) {
      detailLines.push(`Cluster ${cid}: ${clusterFacts(a)} → ${clusterFacts(b)}`);
    } else if (!a && b) {
      detailLines.push(`Cluster ${cid}: appeared (${clusterFacts(b)})`);
    } else if (a && !b) {
      detailLines.push(`Cluster ${cid}: removed (was ${clusterFacts(a)})`);
    }
  }
  if (regionWeightsChanged) {
    detailLines.push(
      `Region weights: ${regionWeightsSig(prev.emphasis)} → ${regionWeightsSig(next.emphasis)}`,
    );
  }
  if (emphasisStepsChanged) {
    detailLines.push(
      `Emphasis steps: ${emphasisStepsSig(prev.emphasis)} → ${emphasisStepsSig(next.emphasis)}`,
    );
  }
  if (focusTargetChanged && selectedId) {
    detailLines.push(`Focus caption: ${fp.captionLine ?? "—"} → ${fn.captionLine ?? "—"}`);
  }

  const selectionCompareLine = formatSelectionCompareLine(prev, next, selectedId);

  let summaryLine: string;
  if (parts.length === 0) {
    summaryLine = "vs prior: unchanged (bounded snapshot)";
  } else {
    summaryLine = `vs prior: ${parts.join(" · ")}`;
  }

  return {
    kind: BOUNDED_SCENE_COMPARE_KIND,
    available: true,
    unavailableReason: null,
    summaryLine,
    detailLines,
    hints,
    selectionCompareLine,
  };
}

const COMPARE_HEX = "#f59e0b";

function tagForHint(
  kind: "wire" | "density" | "http" | "rail" | "cluster" | "region" | "focus",
): DrawablePrimitiveSemanticTag {
  switch (kind) {
    case "wire":
      return "compare_overlay_wire_delta";
    case "density":
      return "compare_overlay_density_delta";
    case "http":
      return "compare_overlay_http_delta";
    case "rail":
      return "compare_overlay_rail_delta";
    case "cluster":
      return "compare_overlay_cluster_delta";
    case "region":
      return "compare_overlay_region_delta";
    case "focus":
      return "compare_overlay_focus_delta";
    default:
      return "compare_overlay_wire_delta";
  }
}

/**
 * Append small deterministic overlay quads so Canvas/WebGPU show compare without a second scene.
 * Tags are non-interactive for selection hit-testing (`mapPrimitiveTagToSelectionId` → null).
 */
export function applyBoundedCompareOverlaysToPrimitives(
  compare: BoundedSceneCompareV0,
  scene: GlassSceneV0,
  spec: LiveVisualSpec,
  widthCss: number,
  strip: BoundedStripLayoutV0,
  out: DrawablePrimitive[],
): void {
  if (!compare.available) {
    return;
  }
  const h = compare.hints;
  const w = widthCss;
  const bandY = strip.primaryY;
  const bandH = strip.primaryH;
  if (h.wireModeChanged) {
    out.push({
      kind: "fill_rect",
      semanticTag: tagForHint("wire"),
      x: w - 22,
      y: bandY + 2,
      width: 6,
      height: 4,
      fillColorHex: COMPARE_HEX,
    });
  }
  if (h.densityOrTailChanged) {
    out.push({
      kind: "fill_rect",
      semanticTag: tagForHint("density"),
      x: 18,
      y: bandY + bandH - 6,
      width: 6,
      height: 4,
      fillColorHex: COMPARE_HEX,
    });
  }
  const markers = buildLiveVisualMarkersLayout(spec, w, { bandOriginY: bandY });
  if (h.reconcileChanged && markers.httpReconcile.show) {
    const c = markers.httpReconcile;
    out.push({
      kind: "fill_rect",
      semanticTag: tagForHint("http"),
      x: c.x + c.width - 5,
      y: c.y + 1,
      width: 4,
      height: 4,
      fillColorHex: COMPARE_HEX,
    });
  }
  if (h.railSignalsChanged) {
    const inset = LIVE_VISUAL_STATE_RAIL_LAYOUT.insetX;
    out.push({
      kind: "fill_rect",
      semanticTag: tagForHint("rail"),
      x: w - inset - 8,
      y: strip.systemY + 2,
      width: 5,
      height: 4,
      fillColorHex: COMPARE_HEX,
    });
  }
  for (const cid of h.clusterIdsWithBoundedDelta) {
    const idx = scene.clusters.findIndex((c) => c.id === cid);
    if (idx < 0) {
      continue;
    }
    const b = clusterSegmentBoundsFromLayout(scene, idx, w, strip);
    if (!b || b.width <= 0 || b.height <= 0) {
      continue;
    }
    out.push({
      kind: "fill_rect",
      semanticTag: tagForHint("cluster"),
      x: b.x + b.width - 5,
      y: b.y + 1,
      width: 4,
      height: Math.min(6, Math.max(3, b.height - 2)),
      fillColorHex: COMPARE_HEX,
    });
  }
  if (h.regionWeightsChanged && scene.regions.length > 0) {
    out.push({
      kind: "fill_rect",
      semanticTag: tagForHint("region"),
      x: 8,
      y: bandY + 6,
      width: 4,
      height: 4,
      fillColorHex: COMPARE_HEX,
    });
  }
  if (h.focusTargetChanged) {
    out.push({
      kind: "fill_rect",
      semanticTag: tagForHint("focus"),
      x: 10,
      y: bandY + 14,
      width: 3,
      height: 3,
      fillColorHex: COMPARE_HEX,
    });
  }
}

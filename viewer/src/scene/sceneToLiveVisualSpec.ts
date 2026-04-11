/**
 * Renderer boundary: Scene System v0 → existing `LiveVisualSpec` (Canvas / WebGPU stack).
 */

import type { LiveVisualSpec } from "../live/liveVisualModel.js";
import { formatActorClusterSummaryLine } from "./boundedActorClusters.js";
import { computeBoundedSceneFocus } from "./boundedSceneFocus.js";
import {
  computeBoundedStripLayoutFromFocus,
  formatBoundedStripReflowSummary,
} from "./boundedSceneFocusReflow.js";
import { formatBoundedEmphasisSummary } from "./boundedSceneEmphasis.js";
import { formatBoundedCompositionCaption } from "./boundedSceneRegions.js";
import type { GlassSceneV0 } from "./glassSceneV0.js";

/** Maps a bounded scene to the strip spec consumed by `liveVisualCanvas` / `liveVisualWebGpu`. */
export function liveVisualSpecFromScene(
  scene: GlassSceneV0,
  focusedSelectionId?: string | null,
): LiveVisualSpec {
  const focus = computeBoundedSceneFocus(scene, focusedSelectionId ?? null);
  const strip = computeBoundedStripLayoutFromFocus(scene, focus, focusedSelectionId ?? null);
  const reflowLine = formatBoundedStripReflowSummary(strip);
  const stripContentBottomY =
    scene.clusters.length > 0 ? strip.clusterY + strip.clusterH : strip.systemY + strip.systemH;
  return {
    mode: scene.wireMode,
    eventTailCount: scene.boundedSampleCount,
    sessionId: scene.sessionLabel,
    lastWireMsg: scene.lastWireMsg,
    lastWireSummary: scene.lastWireSummary,
    warningCode: scene.warningCode,
    resyncReason: scene.resyncReason,
    reconcileSummary: scene.reconcileSummary,
    honestyLine: scene.honesty.line,
    snapshotOriginLabel: scene.snapshotOriginLabel,
    replayPrefixFraction: scene.replayPrefixFraction,
    stripSource: scene.source,
    actorClusterSummaryLine: (() => {
      const s = formatActorClusterSummaryLine(scene.clusters);
      return s.length > 0 ? s : null;
    })(),
    boundedCompositionCaption: (() => {
      const cap = formatBoundedCompositionCaption(scene.regions);
      return cap.length > 0 ? cap : null;
    })(),
    boundedEmphasisSummaryLine: (() => {
      const s = formatBoundedEmphasisSummary(scene.emphasis);
      return s.length > 0 ? s : null;
    })(),
    boundedFocusCaptionLine: focus.captionLine,
    boundedStripReflowLine: reflowLine,
    stripPrimaryY: strip.primaryY,
    stripContentBottomY,
  };
}

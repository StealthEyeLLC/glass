/**
 * Renderer boundary: Scene System v0 → existing `LiveVisualSpec` (Canvas / WebGPU stack).
 */

import type { LiveVisualSpec } from "../live/liveVisualModel.js";
import type { GlassSceneV0 } from "./glassSceneV0.js";

/** Maps a bounded scene to the strip spec consumed by `liveVisualCanvas` / `liveVisualWebGpu`. */
export function liveVisualSpecFromScene(scene: GlassSceneV0): LiveVisualSpec {
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
  };
}

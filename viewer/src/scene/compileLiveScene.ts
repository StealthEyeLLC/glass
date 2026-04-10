/**
 * Compile live session state → Glass Scene v0 (same semantics as prior `buildLiveVisualSpec` path).
 */

import type { LiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import type { HttpReconcileRecord } from "../live/liveHttpReconcile.js";
import { buildLiveVisualSpec, liveVisualDensity01 } from "../live/liveVisualModel.js";
import {
  DEFAULT_SCENE_BOUNDS,
  GLASS_SCENE_V0,
  type GlassSceneV0,
  type SceneEdge,
  type SceneNode,
  type SceneZone,
} from "./glassSceneV0.js";

export interface LiveSceneCompileInput {
  model: LiveSessionModelState;
  lastReconcile: HttpReconcileRecord | null;
}

function liveZones(): SceneZone[] {
  return [
    { id: "z_primary", kind: "primary_band", label: "Wire mode band" },
    { id: "z_density", kind: "density_lane", label: "Tail density" },
    { id: "z_markers", kind: "marker_lane", label: "R/A/Rz slots" },
    { id: "z_http", kind: "annotation", label: "HTTP reconcile chip" },
  ];
}

function liveNodes(spec: ReturnType<typeof buildLiveVisualSpec>): SceneNode[] {
  const d = liveVisualDensity01(spec.eventTailCount);
  const nodes: SceneNode[] = [
    {
      id: "n_mode",
      zoneId: "z_primary",
      kind: "mode_band",
      payload: { mode: spec.mode },
    },
    {
      id: "n_density",
      zoneId: "z_density",
      kind: "density_value",
      payload: { density01: d, tail: spec.eventTailCount },
    },
  ];
  return nodes;
}

/**
 * Deterministic live → scene. Delegates wire/reconcile semantics to `buildLiveVisualSpec`.
 */
export function compileLiveToGlassSceneV0(input: LiveSceneCompileInput): GlassSceneV0 {
  const spec = buildLiveVisualSpec(input.model, input.lastReconcile);
  const zones = liveZones();
  const nodes = liveNodes(spec);
  const edges: SceneEdge[] = [];

  return {
    kind: GLASS_SCENE_V0,
    source: "live",
    bounds: DEFAULT_SCENE_BOUNDS,
    wireMode: spec.mode,
    sessionLabel: spec.sessionId,
    boundedSampleCount: spec.eventTailCount,
    totalEventCardinality: null,
    density01: liveVisualDensity01(spec.eventTailCount),
    lastWireMsg: spec.lastWireMsg,
    lastWireSummary: spec.lastWireSummary,
    warningCode: spec.warningCode,
    resyncReason: spec.resyncReason,
    reconcileSummary: spec.reconcileSummary,
    zones,
    nodes,
    edges,
    honesty: {
      sampleScope: "live_ws_tail",
      line: spec.honestyLine,
    },
  };
}

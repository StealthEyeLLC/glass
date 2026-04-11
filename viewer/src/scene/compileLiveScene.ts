/**
 * Compile live session state → Glass Scene v0 (same semantics as prior `buildLiveVisualSpec` path).
 */

import type { LiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import type { HttpReconcileRecord } from "../live/liveHttpReconcile.js";
import { buildLiveVisualSpec, liveVisualDensity01 } from "../live/liveVisualModel.js";
import { deriveLiveBoundedActorClusters } from "./boundedActorClusters.js";
import {
  computeBoundedSceneEmphasis,
  type BoundedSceneEmphasisV0,
} from "./boundedSceneEmphasis.js";
import { buildLiveBoundedRegions } from "./boundedSceneRegions.js";
import {
  DEFAULT_SCENE_BOUNDS,
  GLASS_SCENE_V0,
  type GlassSceneV0,
  type SceneActorCluster,
  type SceneEdge,
  type SceneNode,
  type SceneZone,
} from "./glassSceneV0.js";

export interface LiveSceneCompileInput {
  model: LiveSessionModelState;
  lastReconcile: HttpReconcileRecord | null;
  /** Optional — last bounded HTTP `snapshot_origin` when WS replace has not yet been observed */
  httpSnapshotOrigin?: string | null;
  /** Vertical Slice v4 — previous emphasis from last compile (shell); omit for calm single-shot tests. */
  previousEmphasis?: BoundedSceneEmphasisV0 | null;
}

function liveZones(): SceneZone[] {
  return [
    {
      id: "z_wire",
      kind: "primary_band",
      label: "Wire update mode (last-applied WS)",
    },
    {
      id: "z_sample",
      kind: "density_lane",
      label: "Bounded WS tail density",
    },
    { id: "z_markers", kind: "marker_lane", label: "R · A · Rz wire slots" },
    {
      id: "z_snapshot",
      kind: "annotation",
      label: "Snapshot origin (F-04 / WS replace)",
    },
    {
      id: "z_reconcile",
      kind: "annotation",
      label: "HTTP reconcile / resync reason",
    },
    {
      id: "z_state_rail",
      kind: "state_rail",
      label: "Bounded state rail (Drawable Primitives v1)",
    },
    {
      id: "z_actor",
      kind: "annotation",
      label: "Bounded actor / sample clusters (current tail)",
    },
  ];
}

function clusterNodes(clusters: readonly SceneActorCluster[]): SceneNode[] {
  return clusters.map((c) => ({
    id: `n_${c.id}`,
    zoneId: "z_actor",
    kind: "cluster_lane" as const,
    payload: {
      lane: c.lane,
      label: c.label,
      sampleCount: c.sampleCount,
      emphasis01: c.emphasis01,
    },
  }));
}

function liveNodes(
  spec: ReturnType<typeof buildLiveVisualSpec>,
  clusters: readonly SceneActorCluster[],
): SceneNode[] {
  const d = liveVisualDensity01(spec.eventTailCount);
  const origin = spec.snapshotOriginLabel ?? "—";
  const resync = spec.resyncReason ?? "—";
  const warn = spec.warningCode ?? "—";
  const nodes: SceneNode[] = [
    ...clusterNodes(clusters),
    {
      id: "n_mode",
      zoneId: "z_wire",
      kind: "mode_band",
      payload: { mode: spec.mode },
    },
    {
      id: "n_density",
      zoneId: "z_sample",
      kind: "density_value",
      payload: { density01: d, tail: spec.eventTailCount },
    },
    {
      id: "n_fact_snapshot",
      zoneId: "z_snapshot",
      kind: "fact_card",
      payload: { key: "snapshot_origin", value: origin },
    },
    {
      id: "n_fact_resync",
      zoneId: "z_reconcile",
      kind: "fact_card",
      payload: { key: "resync_reason", value: resync },
    },
    {
      id: "n_fact_warning",
      zoneId: "z_reconcile",
      kind: "fact_card",
      payload: { key: "warning_code", value: warn },
    },
  ];
  return nodes;
}

/**
 * Deterministic live → scene. Delegates wire/reconcile semantics to `buildLiveVisualSpec`.
 */
export function compileLiveToGlassSceneV0(input: LiveSceneCompileInput): GlassSceneV0 {
  const spec = buildLiveVisualSpec(input.model, input.lastReconcile, {
    httpSnapshotOrigin: input.httpSnapshotOrigin,
  });
  const clusters = deriveLiveBoundedActorClusters(input.model.eventTail, {
    snapshotOriginLabel: spec.snapshotOriginLabel,
    warningCode: spec.warningCode,
    resyncReason: spec.resyncReason,
    reconcileSummary: spec.reconcileSummary,
  });
  const zones = liveZones();
  const nodes = liveNodes(spec, clusters);
  const edges: SceneEdge[] = [];

  const emphasis = computeBoundedSceneEmphasis(
    {
      source: "live",
      wireMode: spec.mode,
      boundedSampleCount: spec.eventTailCount,
      warningCode: spec.warningCode,
      resyncReason: spec.resyncReason,
      reconcileSummary: spec.reconcileSummary,
      snapshotOriginLabel: spec.snapshotOriginLabel,
      replayCursorIndex: null,
      replayEventTotal: null,
      replayPhase: "none",
    },
    input.previousEmphasis ?? null,
  );

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
    snapshotOriginLabel: spec.snapshotOriginLabel,
    replayPrefixFraction: spec.replayPrefixFraction,
    replayCursorIndex: null,
    replayEventTotal: null,
    replayPhase: "none",
    clusters,
    regions: buildLiveBoundedRegions(),
    zones,
    nodes,
    edges,
    honesty: {
      sampleScope: "live_ws_tail",
      line: spec.honestyLine,
    },
    emphasis,
  };
}

/**
 * Compile Tier B replay state → Glass Scene v0 (index-ordered prefix sample, not live tail).
 */

import type { ReplayState } from "../replay/replayModel.js";
import { liveVisualDensity01 } from "../live/liveVisualModel.js";
import type { LiveVisualMode } from "../live/liveVisualModel.js";
import {
  DEFAULT_SCENE_BOUNDS,
  GLASS_SCENE_V0,
  type GlassSceneV0,
  type SceneEdge,
  type SceneNode,
  type SceneZone,
} from "./glassSceneV0.js";

const REPLAY_HONESTY_LINE =
  "Replay index-ordered prefix sample — not live tail, not wall-clock sync, not process topology.";

function replayZones(): SceneZone[] {
  return [
    {
      id: "z_primary",
      kind: "primary_band",
      label: "Prefix depth + wire-mode band (replay sample)",
    },
    { id: "z_density", kind: "density_lane", label: "Prefix density vs pack cardinality" },
    { id: "z_playback", kind: "annotation", label: "Playback / cursor (not wall-clock)" },
  ];
}

function replayWireMode(state: ReplayState): LiveVisualMode {
  if (state.loadStatus === "error") {
    return "warning";
  }
  if (state.loadStatus !== "ready" || state.events.length === 0) {
    return "idle";
  }
  if (state.cursorIndex === 0) {
    return "replace";
  }
  return "append";
}

/**
 * Deterministic replay → scene. Does not invent graph edges — optional sequential edge only.
 */
export function compileReplayToGlassSceneV0(state: ReplayState): GlassSceneV0 {
  const zones = replayZones();
  const nodes: SceneNode[] = [];
  const edges: SceneEdge[] = [];

  if (state.loadStatus === "error") {
    return {
      kind: GLASS_SCENE_V0,
      source: "replay",
      bounds: DEFAULT_SCENE_BOUNDS,
      wireMode: "warning",
      sessionLabel: state.packFileName ?? "—",
      boundedSampleCount: 0,
      totalEventCardinality: null,
      density01: 0,
      lastWireMsg: "replay_load_error",
      lastWireSummary: state.loadError ?? "error",
      warningCode: "replay_load",
      resyncReason: null,
      reconcileSummary: null,
      zones,
      nodes: [
        {
          id: "n_err",
          zoneId: "z_primary",
          kind: "text_annotation",
          payload: { message: state.loadError ?? "" },
        },
      ],
      edges,
      honesty: {
        sampleScope: "load_error",
        line: REPLAY_HONESTY_LINE,
      },
    };
  }

  if (state.loadStatus === "reading") {
    return {
      kind: GLASS_SCENE_V0,
      source: "replay",
      bounds: DEFAULT_SCENE_BOUNDS,
      wireMode: "hello",
      sessionLabel: state.packFileName ?? "—",
      boundedSampleCount: 0,
      totalEventCardinality: null,
      density01: 0,
      lastWireMsg: "replay_reading",
      lastWireSummary: state.packFileName ?? "",
      warningCode: null,
      resyncReason: null,
      reconcileSummary: null,
      zones,
      nodes: [
        {
          id: "n_reading",
          zoneId: "z_primary",
          kind: "text_annotation",
          payload: { phase: "reading" },
        },
      ],
      edges,
      honesty: {
        sampleScope: "empty",
        line: REPLAY_HONESTY_LINE,
      },
    };
  }

  if (state.loadStatus === "idle") {
    return {
      kind: GLASS_SCENE_V0,
      source: "replay",
      bounds: DEFAULT_SCENE_BOUNDS,
      wireMode: "idle",
      sessionLabel: "—",
      boundedSampleCount: 0,
      totalEventCardinality: null,
      density01: 0,
      lastWireMsg: null,
      lastWireSummary: null,
      warningCode: null,
      resyncReason: null,
      reconcileSummary: null,
      zones,
      nodes: [],
      edges,
      honesty: {
        sampleScope: "empty",
        line: REPLAY_HONESTY_LINE,
      },
    };
  }

  const total = state.events.length;
  const prefixLen = total === 0 ? 0 : state.cursorIndex + 1;
  const mode = replayWireMode(state);
  const sessionLabel = state.manifest?.session_id ?? state.packFileName ?? "—";
  const density = liveVisualDensity01(prefixLen, Math.max(total, 1));

  nodes.push(
    {
      id: "n_mode",
      zoneId: "z_primary",
      kind: "mode_band",
      payload: { mode },
    },
    {
      id: "n_density",
      zoneId: "z_density",
      kind: "density_value",
      payload: { density01: density, prefixLen, total },
    },
    {
      id: "n_playback",
      zoneId: "z_playback",
      kind: "playback_badge",
      payload: { playback: state.playback },
    },
    {
      id: "n_cursor",
      zoneId: "z_playback",
      kind: "cursor_position",
      payload: { cursorIndex: state.cursorIndex, total },
    },
  );

  return {
    kind: GLASS_SCENE_V0,
    source: "replay",
    bounds: DEFAULT_SCENE_BOUNDS,
    wireMode: mode,
    sessionLabel,
    boundedSampleCount: prefixLen,
    totalEventCardinality: total,
    density01: density,
    lastWireMsg: total === 0 ? null : "replay_prefix",
    lastWireSummary:
      total === 0
        ? "empty pack"
        : `event ${state.cursorIndex + 1}/${total} (index order)`,
    warningCode: null,
    resyncReason: null,
    reconcileSummary: null,
    zones,
    nodes,
    edges,
    honesty: {
      sampleScope: total === 0 ? "empty" : "replay_index_prefix",
      line: REPLAY_HONESTY_LINE,
    },
  };
}

import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { buildLiveVisualSpec } from "../live/liveVisualModel.js";
import { initialReplayState, reduceReplay } from "../replay/replayModel.js";
import {
  CANONICAL_EVENT_SCHEMA_VERSION,
  PACK_FORMAT_SCAFFOLD_V0,
} from "../pack/types.js";
import type { GlassEvent, GlassManifest } from "../pack/types.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import { compileReplayToGlassSceneV0 } from "./compileReplayScene.js";
import { buildBoundedVisualGeometryPrimitives } from "./drawablePrimitivesV0.js";
import { sceneToDrawablePrimitives as sceneToPrimitives } from "./sceneToDrawablePrimitives.js";
import {
  listSemanticTagsForPrimitives,
  listSemanticTagsForScene,
  listSemanticTagsForSceneWebGpuExpansion,
  listSemanticTagsForWebGpuPrimitiveExpansion,
  primitiveTagsSummary,
} from "./semanticTagSummaryV0.js";

function replayManifest(): GlassManifest {
  return {
    pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
    session_id: "s1",
    capture_mode: "replay",
    sanitized: false,
    human_readable_redaction_summary: [],
    share_safe_recommended: false,
  };
}

function replayEv(seq: number): GlassEvent {
  return {
    schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
    event_id: `e${seq}`,
    session_id: "s1",
    ts_ns: seq,
    seq,
    kind: "process_poll_sample",
    actor: { entity_type: "process", entity_id: "p1" },
    attrs: {},
    source: {
      adapter: "t",
      quality: "direct",
      time_domain: "session_monotonic",
    },
  };
}

describe("listSemanticTagsForPrimitives / primitiveTagsSummary", () => {
  it("matches per-primitive semanticTag in order", () => {
    const spec = buildLiveVisualSpec(
      createInitialLiveSessionModelState("s"),
      null,
    );
    const prim = buildBoundedVisualGeometryPrimitives(spec, 200, 100);
    const tags = listSemanticTagsForPrimitives(prim);
    expect(tags).toEqual(prim.map((p) => p.semanticTag));
    expect(primitiveTagsSummary(prim)).toEqual(tags);
  });
});

describe("listSemanticTagsForScene", () => {
  it("matches sceneToDrawablePrimitives tag order for live", () => {
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("sid"),
      lastReconcile: null,
    });
    expect(listSemanticTagsForScene(scene)).toEqual(
      sceneToPrimitives(scene).map((p) => p.semanticTag),
    );
  });

  it("live and replay share the same primitive tag prefix when strip layout matches", () => {
    const liveScene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("sid"),
      lastReconcile: null,
    });
    let st = initialReplayState();
    st = reduceReplay(st, {
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: replayManifest(),
      events: [replayEv(1)],
    });
    st = reduceReplay(st, { type: "seek_index", index: 0 });
    const replayScene = compileReplayToGlassSceneV0(st);
    const a = listSemanticTagsForScene(liveScene).slice(0, 5);
    const b = listSemanticTagsForScene(replayScene).slice(0, 5);
    expect(a).toEqual(b);
    expect(a).toEqual([
      "band_background",
      "density_band",
      "tick_slot_replace",
      "tick_slot_append",
      "tick_slot_resync",
    ]);
  });
});

describe("listSemanticTagsForWebGpuPrimitiveExpansion", () => {
  it("replaces each stroke with four edge tags in deterministic order", () => {
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("sid"),
      lastReconcile: null,
    });
    const prim = sceneToPrimitives(scene);
    const expanded = listSemanticTagsForWebGpuPrimitiveExpansion(prim);
    const strokes = prim.filter((p) => p.kind === "stroke_rect");
    expect(strokes.length).toBe(1);
    expect(expanded[expanded.length - 4]).toBe("band_frame_top");
    expect(expanded[expanded.length - 1]).toBe("band_frame_right");
  });

  it("listSemanticTagsForSceneWebGpuExpansion matches listSemanticTagsForWebGpuPrimitiveExpansion(scene primitives)", () => {
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("sid"),
      lastReconcile: null,
    });
    expect(listSemanticTagsForSceneWebGpuExpansion(scene)).toEqual(
      listSemanticTagsForWebGpuPrimitiveExpansion(sceneToPrimitives(scene)),
    );
  });
});

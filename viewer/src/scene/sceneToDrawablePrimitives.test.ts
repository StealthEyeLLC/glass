import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { initialReplayState, reduceReplay } from "../replay/replayModel.js";
import {
  CANONICAL_EVENT_SCHEMA_VERSION,
  PACK_FORMAT_SCAFFOLD_V0,
} from "../pack/types.js";
import type { GlassEvent, GlassManifest } from "../pack/types.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import { compileReplayToGlassSceneV0 } from "./compileReplayScene.js";
import {
  appendBoundedActorClusterStrip,
  applyBoundedEmphasisOverlays,
  applyBoundedSceneComposition,
  buildBoundedVisualGeometryPrimitives,
} from "./drawablePrimitivesV0.js";
import {
  applyBoundedCompareOverlaysToPrimitives,
  computeBoundedSceneCompare,
} from "./boundedSceneCompare.js";
import { applyBoundedSceneFocusToPrimitives, computeBoundedSceneFocus } from "./boundedSceneFocus.js";
import { computeBoundedStripLayoutFromFocus } from "./boundedSceneFocusReflow.js";
import { liveVisualSpecFromScene } from "./sceneToLiveVisualSpec.js";
import { sceneToDrawablePrimitives } from "./sceneToDrawablePrimitives.js";
import { listSemanticTagsForScene } from "./semanticTagSummaryV0.js";

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

describe("sceneToDrawablePrimitives", () => {
  it("matches buildBoundedVisualGeometryPrimitives(liveVisualSpecFromScene(scene), …)", () => {
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("sid"),
      lastReconcile: null,
    });
    const a = sceneToDrawablePrimitives(scene);
    const focus = computeBoundedSceneFocus(scene, null);
    const strip = computeBoundedStripLayoutFromFocus(scene, focus, null);
    const cmp0 = computeBoundedSceneCompare(null, scene, { selectedId: null });
    const spec0 = liveVisualSpecFromScene(scene, null, { previousScene: null, compare: cmp0 });
    const b = buildBoundedVisualGeometryPrimitives(
      spec0,
      scene.bounds.widthCss,
      scene.bounds.heightCss,
      strip,
    );
    appendBoundedActorClusterStrip(scene.clusters, scene.bounds.widthCss, b, strip);
    applyBoundedSceneComposition(scene, scene.bounds.widthCss, scene.bounds.heightCss, b, strip);
    applyBoundedEmphasisOverlays(scene, scene.bounds.widthCss, scene.bounds.heightCss, b, strip);
    applyBoundedSceneFocusToPrimitives(scene, focus, scene.bounds.widthCss, scene.bounds.heightCss, b, strip);
    applyBoundedCompareOverlaysToPrimitives(
      cmp0,
      scene,
      spec0,
      scene.bounds.widthCss,
      strip,
      b,
    );
    expect(a).toEqual(b);
  });

  it("uses explicit layout size when provided", () => {
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("sid"),
      lastReconcile: null,
    });
    const withLayout = sceneToDrawablePrimitives(scene, { widthCss: 400, heightCss: 200 });
    const focus400 = computeBoundedSceneFocus(scene, null);
    const strip400 = computeBoundedStripLayoutFromFocus(scene, focus400, null);
    const cmp400 = computeBoundedSceneCompare(null, scene, { selectedId: null });
    const spec400 = liveVisualSpecFromScene(scene, null, { previousScene: null, compare: cmp400 });
    const direct = buildBoundedVisualGeometryPrimitives(spec400, 400, 200, strip400);
    appendBoundedActorClusterStrip(scene.clusters, 400, direct, strip400);
    applyBoundedSceneComposition(scene, 400, 200, direct, strip400);
    applyBoundedEmphasisOverlays(scene, 400, 200, direct, strip400);
    applyBoundedSceneFocusToPrimitives(scene, focus400, 400, 200, direct, strip400);
    applyBoundedCompareOverlaysToPrimitives(
      cmp400,
      scene,
      spec400,
      400,
      strip400,
      direct,
    );
    expect(withLayout).toEqual(direct);
  });

  it("produces primitives for a replay-compiled scene", () => {
    let st = initialReplayState();
    st = reduceReplay(st, {
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: replayManifest(),
      events: [replayEv(1), replayEv(2)],
    });
    st = reduceReplay(st, { type: "seek_index", index: 1 });
    const scene = compileReplayToGlassSceneV0(st);
    const p = sceneToDrawablePrimitives(scene);
    expect(p.length).toBeGreaterThan(3);
    expect(p[0]?.kind).toBe("fill_rect");
    expect(p[0]?.semanticTag).toBe("band_background");
    expect(p.map((x) => x.semanticTag)).toContain("density_band");
    expect(p.map((x) => x.semanticTag)).toContain("band_frame");
  });

  it("live and replay share the same semantic tag prefix for the strip", () => {
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
    const a = listSemanticTagsForScene(liveScene).slice(0, 8);
    const b = listSemanticTagsForScene(replayScene).slice(0, 8);
    expect(a.slice(0, 7)).toEqual(b.slice(0, 7));
    expect(a[0]).toBe("band_background");
    expect(a[1]).toBe("composition_panel_primary");
    expect(a[2]).toBe("composition_accent_primary");
    expect(a[3]).toBe("density_band");
    expect(a[4]).toBe("tick_slot_replace");
  });
});

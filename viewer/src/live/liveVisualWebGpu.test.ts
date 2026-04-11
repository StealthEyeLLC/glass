import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "./applyLiveSessionMessage.js";
import { buildLiveVisualSpec } from "./liveVisualModel.js";
import { compileLiveToGlassSceneV0 } from "../scene/compileLiveScene.js";
import { applyBoundedSceneFocusToPrimitives, computeBoundedSceneFocus } from "../scene/boundedSceneFocus.js";
import { computeBoundedStripLayoutFromFocus } from "../scene/boundedSceneFocusReflow.js";
import {
  applyBoundedCompareOverlaysToPrimitives,
  computeBoundedSceneCompare,
} from "../scene/boundedSceneCompare.js";
import { sceneToDrawablePrimitives } from "../scene/sceneToDrawablePrimitives.js";
import {
  appendBoundedActorClusterStrip,
  applyBoundedEmphasisOverlays,
  applyBoundedSceneComposition,
  buildBoundedVisualGeometryPrimitives,
  expandStrokeRectToFillRects,
} from "../scene/drawablePrimitivesV0.js";
import { liveVisualSpecFromScene } from "../scene/sceneToLiveVisualSpec.js";
import {
  buildDrawablePrimitivesWebGpuVertexData,
  buildLiveVisualWebGpuVertexData,
  hexToRgba01,
  pxRectToTriangleList,
} from "./liveVisualWebGpu.js";

describe("hexToRgba01", () => {
  it("parses #rrggbb", () => {
    const [r, g, b, a] = hexToRgba01("#1d4ed8");
    expect(r).toBeGreaterThan(0);
    expect(g).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
    expect(a).toBe(1);
  });

  it("falls back for invalid hex", () => {
    const [r, g, b] = hexToRgba01("not-a-color");
    expect(r).toBeGreaterThan(0);
    expect(g).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(0);
  });
});

describe("pxRectToTriangleList", () => {
  it("emits 36 floats per quad (6 verts × 6 floats)", () => {
    const p = pxRectToTriangleList(0, 0, 10, 10, 100, 100, [1, 0, 0, 1]);
    expect(p.length).toBe(36);
  });
});

describe("buildLiveVisualWebGpuVertexData", () => {
  it("produces non-empty triangle data for default spec", () => {
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("sid"), null);
    const layout = { widthCss: 200, heightCss: 100 };
    const data = buildLiveVisualWebGpuVertexData(spec, layout);
    expect(data.length).toBeGreaterThan(0);
    expect(data.length % 6).toBe(0);
  });
});

describe("buildDrawablePrimitivesWebGpuVertexData", () => {
  it("matches scene-derived primitives for the same layout", () => {
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("sid"),
      lastReconcile: null,
    });
    const layout = { widthCss: 200, heightCss: 100 };
    const fromScene = buildDrawablePrimitivesWebGpuVertexData(
      sceneToDrawablePrimitives(scene, layout),
      layout,
    );
    const cmp = computeBoundedSceneCompare(null, scene, { selectedId: null });
    const spec = liveVisualSpecFromScene(scene, null, { previousScene: null, compare: cmp });
    const focus = computeBoundedSceneFocus(scene, null);
    const strip = computeBoundedStripLayoutFromFocus(scene, focus, null);
    const manual = buildBoundedVisualGeometryPrimitives(spec, layout.widthCss, layout.heightCss, strip);
    appendBoundedActorClusterStrip(scene.clusters, layout.widthCss, manual, strip);
    applyBoundedSceneComposition(scene, layout.widthCss, layout.heightCss, manual, strip);
    applyBoundedEmphasisOverlays(scene, layout.widthCss, layout.heightCss, manual, strip);
    applyBoundedSceneFocusToPrimitives(scene, focus, layout.widthCss, layout.heightCss, manual, strip);
    applyBoundedCompareOverlaysToPrimitives(cmp, scene, spec, layout.widthCss, strip, manual);
    const fromManual = buildDrawablePrimitivesWebGpuVertexData(manual, layout);
    expect(fromScene.length).toBe(fromManual.length);
    expect([...fromScene]).toEqual([...fromManual]);
  });

  it("expands tagged strokes to edge-tagged fills without changing float count vs untagged geometry", () => {
    const layout = { widthCss: 200, heightCss: 100 };
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("sid"),
      lastReconcile: null,
    });
    const buf = buildDrawablePrimitivesWebGpuVertexData(sceneToDrawablePrimitives(scene, layout), layout);
    const primitives = sceneToDrawablePrimitives(scene, layout);
    let manualFloats = 0;
    for (const pr of primitives) {
      if (pr.kind === "fill_rect") {
        manualFloats += 36;
      } else {
        manualFloats += expandStrokeRectToFillRects(pr).length * 36;
      }
    }
    expect(buf.length).toBe(manualFloats);
  });
});

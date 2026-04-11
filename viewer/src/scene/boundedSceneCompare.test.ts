import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import {
  applyBoundedCompareOverlaysToPrimitives,
  computeBoundedSceneCompare,
} from "./boundedSceneCompare.js";
import { computeBoundedSceneFocus } from "./boundedSceneFocus.js";
import { computeBoundedStripLayoutFromFocus } from "./boundedSceneFocusReflow.js";
import type { DrawablePrimitive } from "./drawablePrimitivesV0.js";
import { liveVisualSpecFromScene } from "./sceneToLiveVisualSpec.js";
import { sceneToDrawablePrimitives } from "./sceneToDrawablePrimitives.js";

function sceneFromTail(len: number) {
  const m = createInitialLiveSessionModelState("s-compare");
  m.eventTail = Array.from({ length: len }, (_, i) => ({
    kind: "process_poll_sample",
    seq: i + 1,
  }));
  return compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
}

describe("computeBoundedSceneCompare", () => {
  it("marks unavailable when there is no prior frame", () => {
    const next = sceneFromTail(1);
    const c = computeBoundedSceneCompare(null, next, { selectedId: null });
    expect(c.available).toBe(false);
    expect(c.summaryLine).toBeNull();
    expect(c.unavailableReason).toMatch(/prior/i);
  });

  it("detects tail and wire presentation changes between two honest bounded frames", () => {
    const prev = sceneFromTail(2);
    const next = sceneFromTail(5);
    const c = computeBoundedSceneCompare(prev, next, { selectedId: null });
    expect(c.available).toBe(true);
    expect(c.summaryLine).toMatch(/tail\/samples/);
    expect(c.hints.densityOrTailChanged).toBe(true);
    expect(c.detailLines.some((l) => l.includes("2 → 5"))).toBe(true);
  });

  it("reports unchanged summary when bounded facts match", () => {
    const a = sceneFromTail(3);
    const b = sceneFromTail(3);
    const c = computeBoundedSceneCompare(a, b, { selectedId: null });
    expect(c.available).toBe(true);
    expect(c.summaryLine).toMatch(/unchanged/);
    expect(c.detailLines.length).toBe(0);
  });

  it("emits selection-scoped cluster line when the same id changes across frames", () => {
    const prev = sceneFromTail(2);
    const next = sceneFromTail(4);
    expect(next.clusters.some((c) => c.id === "cl_process")).toBe(true);
    const sel = `glass.sel.v0:cluster:cl_process`;
    const c = computeBoundedSceneCompare(prev, next, { selectedId: sel });
    expect(c.selectionCompareLine).not.toBeNull();
    expect(c.selectionCompareLine).toMatch(/→/);
  });
});

describe("applyBoundedCompareOverlaysToPrimitives", () => {
  it("adds density compare overlay when tail length changes", () => {
    const prev = sceneFromTail(1);
    const next = sceneFromTail(2);
    const cmp = computeBoundedSceneCompare(prev, next, { selectedId: null });
    expect(cmp.hints.densityOrTailChanged).toBe(true);
    const focus = computeBoundedSceneFocus(next, null);
    const strip = computeBoundedStripLayoutFromFocus(next, focus, null);
    const spec = liveVisualSpecFromScene(next, null, { previousScene: prev, compare: cmp });
    const out: DrawablePrimitive[] = [];
    applyBoundedCompareOverlaysToPrimitives(cmp, next, spec, next.bounds.widthCss, strip, out);
    expect(out.some((p) => p.semanticTag === "compare_overlay_density_delta")).toBe(true);
  });
});

describe("sceneToDrawablePrimitives compare wiring", () => {
  it("matches with and without prior frame when prior is null", () => {
    const scene = sceneFromTail(2);
    const a = sceneToDrawablePrimitives(scene);
    const b = sceneToDrawablePrimitives(scene, undefined, { previousScene: null });
    expect(a).toEqual(b);
  });

  it("adds compare overlay primitives when prior differs", () => {
    const prev = sceneFromTail(1);
    const next = sceneFromTail(3);
    const prim = sceneToDrawablePrimitives(next, undefined, { previousScene: prev });
    expect(prim.some((p) => p.semanticTag === "compare_overlay_density_delta")).toBe(true);
  });
});

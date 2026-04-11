/**
 * Vertical Slice v17 — renderer / interaction parity (deterministic, no pixels).
 */
import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "./applyLiveSessionMessage.js";
import { compileLiveToGlassSceneV0 } from "../scene/compileLiveScene.js";
import { sceneToDrawablePrimitives } from "../scene/sceneToDrawablePrimitives.js";

function sceneFromTail(len: number) {
  const m = createInitialLiveSessionModelState("s-v17-parity");
  m.eventTail = Array.from({ length: len }, (_, i) => ({
    kind: "process_poll_sample",
    seq: i + 1,
  }));
  return compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
}

function countCompareOverlayTags(primitives: readonly { semanticTag: string }[]): number {
  return primitives.filter((p) => p.semanticTag.startsWith("compare_overlay")).length;
}

describe("Vertical Slice v17 — compare baseline parity (Canvas / WebGPU primitive stream)", () => {
  it("adds compare overlay primitives when previousScene is set vs absent (same scene)", () => {
    const prev = sceneFromTail(2);
    const next = sceneFromTail(4);
    const layout = { widthCss: next.bounds.widthCss, heightCss: next.bounds.heightCss };
    const withBaseline = sceneToDrawablePrimitives(next, layout, { previousScene: prev });
    const withoutBaseline = sceneToDrawablePrimitives(next, layout, { previousScene: null });
    expect(countCompareOverlayTags(withBaseline)).toBeGreaterThan(0);
    expect(countCompareOverlayTags(withoutBaseline)).toBe(0);
  });
});

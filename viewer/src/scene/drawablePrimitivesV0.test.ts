import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { buildLiveVisualSpec } from "../live/liveVisualModel.js";
import {
  buildBoundedVisualGeometryPrimitives,
  expandStrokeRectToFillRects,
} from "./drawablePrimitivesV0.js";

describe("buildBoundedVisualGeometryPrimitives", () => {
  it("starts with full-canvas background then band", () => {
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), null);
    const p = buildBoundedVisualGeometryPrimitives(spec, 200, 100);
    expect(p[0]).toMatchObject({
      kind: "fill_rect",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      fillColorHex: "#f1f5f9",
    });
    expect(p[1]?.kind).toBe("fill_rect");
    expect(p[1]).toMatchObject({ x: 16, y: 16 });
  });

  it("includes band frame stroke last in sequence", () => {
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), null);
    const p = buildBoundedVisualGeometryPrimitives(spec, 200, 100);
    const last = p[p.length - 1];
    expect(last).toMatchObject({
      kind: "stroke_rect",
      strokeColorHex: "#cbd5e1",
      lineWidthCss: 1,
    });
  });
});

describe("expandStrokeRectToFillRects", () => {
  it("emits four thin fills for a 10×10 stroke", () => {
    const fills = expandStrokeRectToFillRects({
      kind: "stroke_rect",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      strokeColorHex: "#000000",
      lineWidthCss: 1,
    });
    expect(fills).toHaveLength(4);
    expect(fills.every((f) => f.kind === "fill_rect")).toBe(true);
  });
});

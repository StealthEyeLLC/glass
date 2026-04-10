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
      semanticTag: "band_background",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      fillColorHex: "#f1f5f9",
    });
    expect(p[1]?.kind).toBe("fill_rect");
    expect(p[1]).toMatchObject({ semanticTag: "density_band", x: 16, y: 16 });
  });

  it("orders tick slots replace → append → resync", () => {
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), null);
    const p = buildBoundedVisualGeometryPrimitives(spec, 200, 100);
    expect(p[2]?.semanticTag).toBe("tick_slot_replace");
    expect(p[3]?.semanticTag).toBe("tick_slot_append");
    expect(p[4]?.semanticTag).toBe("tick_slot_resync");
  });

  it("places band frame then Vertical Slice state rail (last stroke is state_rail_frame)", () => {
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), null);
    const p = buildBoundedVisualGeometryPrimitives(spec, 200, 100);
    const band = p.find((x) => x.semanticTag === "band_frame");
    const last = p[p.length - 1];
    expect(band).toMatchObject({
      kind: "stroke_rect",
      semanticTag: "band_frame",
      strokeColorHex: "#cbd5e1",
      lineWidthCss: 1,
    });
    expect(last).toMatchObject({
      kind: "stroke_rect",
      semanticTag: "state_rail_frame",
      strokeColorHex: "#64748b",
      lineWidthCss: 1,
    });
  });

  it("tags HTTP chip fill and frame when reconcile exists", () => {
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), {
      trigger: "manual",
      status: "ok",
      eventsCount: 1,
    });
    const p = buildBoundedVisualGeometryPrimitives(spec, 200, 100);
    const chipFill = p.find((x) => x.semanticTag === "http_chip_fill");
    const chipFrame = p.find((x) => x.semanticTag === "http_chip_frame");
    expect(chipFill?.kind).toBe("fill_rect");
    expect(chipFrame?.kind).toBe("stroke_rect");
  });
});

describe("expandStrokeRectToFillRects", () => {
  it("emits four thin fills for a 10×10 stroke with band_frame edge tags", () => {
    const fills = expandStrokeRectToFillRects({
      kind: "stroke_rect",
      semanticTag: "band_frame",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      strokeColorHex: "#000000",
      lineWidthCss: 1,
    });
    expect(fills).toHaveLength(4);
    expect(fills.map((f) => f.semanticTag)).toEqual([
      "band_frame_top",
      "band_frame_bottom",
      "band_frame_left",
      "band_frame_right",
    ]);
    expect(fills.every((f) => f.kind === "fill_rect")).toBe(true);
  });

  it("uses state_rail_frame_* tags for state_rail_frame strokes", () => {
    const fills = expandStrokeRectToFillRects({
      kind: "stroke_rect",
      semanticTag: "state_rail_frame",
      x: 0,
      y: 52,
      width: 100,
      height: 20,
      strokeColorHex: "#64748b",
      lineWidthCss: 1,
    });
    expect(fills.map((f) => f.semanticTag)).toEqual([
      "state_rail_frame_top",
      "state_rail_frame_bottom",
      "state_rail_frame_left",
      "state_rail_frame_right",
    ]);
  });

  it("uses http_chip_frame_* tags for http_chip_frame strokes", () => {
    const fills = expandStrokeRectToFillRects({
      kind: "stroke_rect",
      semanticTag: "http_chip_frame",
      x: 1,
      y: 2,
      width: 8,
      height: 6,
      strokeColorHex: "#64748b",
      lineWidthCss: 1,
    });
    expect(fills.map((f) => f.semanticTag)).toEqual([
      "http_chip_frame_top",
      "http_chip_frame_bottom",
      "http_chip_frame_left",
      "http_chip_frame_right",
    ]);
  });
});

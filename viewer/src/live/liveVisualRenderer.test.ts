import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "./applyLiveSessionMessage.js";
import { buildLiveVisualSpec } from "./liveVisualModel.js";
import { paintLiveVisualSurface } from "./liveVisualRenderer.js";

describe("paintLiveVisualSurface", () => {
  it("paints Canvas 2D and hides WebGPU canvas when bundle is null", async () => {
    const c2d = document.createElement("canvas");
    const cgpu = document.createElement("canvas");
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), null);
    const r = await paintLiveVisualSurface(c2d, cgpu, spec, { widthCss: 200, heightCss: 100 }, null);
    expect(r.webGpuActive).toBe(false);
    expect(cgpu.hidden).toBe(true);
    expect(c2d.hidden).toBe(false);
  });
});

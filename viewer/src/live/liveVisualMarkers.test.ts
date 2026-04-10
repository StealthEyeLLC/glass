import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "./applyLiveSessionMessage.js";
import { buildLiveVisualSpec } from "./liveVisualModel.js";
import {
  buildLiveVisualMarkersLayout,
  LIVE_VISUAL_BAND_LAYOUT,
  LIVE_VISUAL_TICK_INACTIVE,
  liveVisualTickActiveFill,
} from "./liveVisualMarkers.js";

const W = 360;

describe("buildLiveVisualMarkersLayout", () => {
  it("places three ticks at deterministic third centers", () => {
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), null);
    const lo = buildLiveVisualMarkersLayout(spec, W);
    const bandInnerW = W - 32;
    const third = bandInnerW / 3;
    const bx = LIVE_VISUAL_BAND_LAYOUT.originX;
    expect(lo.ticks[0].centerX).toBeCloseTo(bx + third * 0.5, 5);
    expect(lo.ticks[1].centerX).toBeCloseTo(bx + third * 1.5, 5);
    expect(lo.ticks[2].centerX).toBeCloseTo(bx + third * 2.5, 5);
    expect(lo.ticks[0].kind).toBe("replace");
    expect(lo.ticks[1].kind).toBe("append");
    expect(lo.ticks[2].kind).toBe("resync_wire");
  });

  it("activates replace tick only for replace mode", () => {
    const base = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), null);
    const spec = { ...base, mode: "replace" as const };
    const lo = buildLiveVisualMarkersLayout(spec, W);
    expect(lo.ticks[0].active).toBe(true);
    expect(lo.ticks[1].active).toBe(false);
    expect(lo.ticks[2].active).toBe(false);
  });

  it("activates append tick only for append mode", () => {
    const base = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), null);
    const spec = { ...base, mode: "append" as const };
    const lo = buildLiveVisualMarkersLayout(spec, W);
    expect(lo.ticks[0].active).toBe(false);
    expect(lo.ticks[1].active).toBe(true);
    expect(lo.ticks[2].active).toBe(false);
  });

  it("activates resync tick only for resync mode", () => {
    const base = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), null);
    const spec = { ...base, mode: "resync" as const };
    const lo = buildLiveVisualMarkersLayout(spec, W);
    expect(lo.ticks[0].active).toBe(false);
    expect(lo.ticks[1].active).toBe(false);
    expect(lo.ticks[2].active).toBe(true);
  });

  it("has no wire ticks active for hello, idle, none_delta, warning", () => {
    for (const mode of ["hello", "idle", "none_delta", "warning"] as const) {
      const base = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), null);
      const spec = { ...base, mode };
      const lo = buildLiveVisualMarkersLayout(spec, W);
      expect(lo.ticks.every((t) => !t.active), mode).toBe(true);
    }
  });

  it("shows HTTP chip when reconcileSummary is set (can coexist with resync tick)", () => {
    const base = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), {
      trigger: "session_resync_required",
      status: "ok",
      eventsCount: 1,
    });
    const spec = { ...base, mode: "resync" as const };
    const lo = buildLiveVisualMarkersLayout(spec, W);
    expect(lo.httpReconcile.show).toBe(true);
    expect(lo.httpReconcile.width).toBeGreaterThan(0);
    expect(lo.ticks[2].active).toBe(true);
  });

  it("hides HTTP chip when no reconcile line", () => {
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), null);
    const lo = buildLiveVisualMarkersLayout(spec, W);
    expect(lo.httpReconcile.show).toBe(false);
  });

  it("scales chip X with width (anchored to right margin)", () => {
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("s"), {
      trigger: "manual",
      status: "ok",
    });
    const lo200 = buildLiveVisualMarkersLayout(spec, 200);
    const lo400 = buildLiveVisualMarkersLayout(spec, 400);
    expect(lo200.httpReconcile.x).toBe(200 - 16 - lo200.httpReconcile.width);
    expect(lo400.httpReconcile.x).toBe(400 - 16 - lo400.httpReconcile.width);
  });
});

describe("liveVisualTickActiveFill", () => {
  it("returns mode palette colors", () => {
    expect(liveVisualTickActiveFill("replace")).toMatch(/^#/);
    expect(liveVisualTickActiveFill("append")).toMatch(/^#/);
    expect(liveVisualTickActiveFill("resync_wire")).toMatch(/^#/);
  });
});

describe("LIVE_VISUAL_TICK_INACTIVE", () => {
  it("is a fixed dim neutral", () => {
    expect(LIVE_VISUAL_TICK_INACTIVE).toBe("#e2e8f0");
  });
});

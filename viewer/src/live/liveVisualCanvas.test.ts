import { describe, expect, it, vi } from "vitest";
import { createInitialLiveSessionModelState } from "./applyLiveSessionMessage.js";
import { buildLiveVisualSpec } from "./liveVisualModel.js";
import { compileLiveToGlassSceneV0 } from "../scene/compileLiveScene.js";
import {
  renderLiveVisualIntoContext,
  renderLiveVisualOnCanvas,
  renderLiveVisualTextOverlayIntoContext,
} from "./liveVisualCanvas.js";

function createMock2dContext(): CanvasRenderingContext2D {
  return {
    fillStyle: "",
    strokeStyle: "",
    font: "",
    lineWidth: 1,
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

function findBandFillRect(ctx: CanvasRenderingContext2D): number[] {
  const calls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls as number[][];
  const band = calls.find((c) => c[0] === 16 && c[1] === 16 && c[3] === 28);
  if (!band) {
    throw new Error("expected density band fillRect at y=16 h=28");
  }
  return band;
}

describe("renderLiveVisualIntoContext", () => {
  it("lays out append mode band and labels (deterministic geometry)", () => {
    const ctx = createMock2dContext();
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("sid"), null);
    const s = { ...spec, mode: "append" as const, eventTailCount: 5 };
    renderLiveVisualIntoContext(ctx, s, 200, 100);
    const fillRect = ctx.fillRect as ReturnType<typeof vi.fn>;
    expect(fillRect).toHaveBeenCalled();
    expect(fillRect.mock.calls[0]).toEqual([0, 0, 200, 100]);
    const bandCall = findBandFillRect(ctx);
    expect(bandCall[0]).toBe(16);
    expect(bandCall[1]).toBe(16);
    expect(bandCall[3]).toBe(28);
    const bandW = bandCall[2] as number;
    expect(bandW).toBeGreaterThan(16);
    expect(bandW).toBeLessThanOrEqual(200 - 16);
    const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
    expect(fillText.mock.calls.some((c) => String(c[0]).includes("mode=append"))).toBe(true);
  });

  it("draws marker ticks and HTTP chip without throwing (resync + reconcile)", () => {
    const ctx = createMock2dContext();
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("sid"), {
      trigger: "session_resync_required",
      status: "ok",
      eventsCount: 2,
    });
    const s = { ...spec, mode: "resync" as const };
    renderLiveVisualIntoContext(ctx, s, 200, 100);
    const strokeRect = ctx.strokeRect as ReturnType<typeof vi.fn>;
    expect(strokeRect.mock.calls.length).toBeGreaterThanOrEqual(2);
    const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
    expect(fillText.mock.calls.some((c) => c[0] === "HTTP")).toBe(true);
  });

  it("draws HTTP reconcile line when present", () => {
    const ctx = createMock2dContext();
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("sid"), {
      trigger: "manual",
      status: "ok",
      eventsCount: 3,
    });
    renderLiveVisualIntoContext(ctx, spec, 200, 100);
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0] as string);
    expect(texts.some((t) => t.includes("HTTP:"))).toBe(true);
  });
});

describe("renderLiveVisualTextOverlayIntoContext", () => {
  it("clears then draws mode line (hybrid overlay path)", () => {
    const ctx = createMock2dContext();
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("sid"), null);
    renderLiveVisualTextOverlayIntoContext(ctx, spec, 200, 100);
    const clearRect = ctx.clearRect as ReturnType<typeof vi.fn>;
    expect(clearRect).toHaveBeenCalledWith(0, 0, 200, 100);
    const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
    expect(fillText.mock.calls.some((c) => String(c[0]).includes("mode="))).toBe(true);
  });
});

describe("renderLiveVisualOnCanvas", () => {
  it("returns true and sizes canvas when 2D path runs (vitest.setup stubs jsdom)", () => {
    const canvas = document.createElement("canvas");
    const m = createInitialLiveSessionModelState("sid");
    const scene = compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
    const ok = renderLiveVisualOnCanvas(canvas, scene, {
      layout: { widthCss: 200, heightCss: 100 },
    });
    expect(ok).toBe(true);
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
  });

  it("returns false when getContext returns null", () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const canvas = document.createElement("canvas");
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("sid"),
      lastReconcile: null,
    });
    expect(renderLiveVisualOnCanvas(canvas, scene)).toBe(false);
    spy.mockRestore();
  });
});

import { describe, expect, it, vi } from "vitest";
import { createInitialLiveSessionModelState } from "./applyLiveSessionMessage.js";
import { buildLiveVisualSpec } from "./liveVisualModel.js";
import { renderLiveVisualIntoContext, renderLiveVisualOnCanvas } from "./liveVisualCanvas.js";

function createMock2dContext(): CanvasRenderingContext2D {
  return {
    fillStyle: "",
    strokeStyle: "",
    font: "",
    lineWidth: 1,
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
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
    const bandCall = fillRect.mock.calls[1];
    expect(bandCall[0]).toBe(16);
    expect(bandCall[1]).toBe(16);
    expect(bandCall[3]).toBe(28);
    const bandW = bandCall[2] as number;
    expect(bandW).toBeGreaterThan(16);
    expect(bandW).toBeLessThanOrEqual(200 - 16);
    const fillText = ctx.fillText as ReturnType<typeof vi.fn>;
    expect(fillText.mock.calls.some((c) => String(c[0]).includes("mode=append"))).toBe(true);
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

describe("renderLiveVisualOnCanvas", () => {
  it("returns true and sizes canvas when 2D path runs (vitest.setup stubs jsdom)", () => {
    const canvas = document.createElement("canvas");
    const m = createInitialLiveSessionModelState("sid");
    const spec = buildLiveVisualSpec(m, null);
    const ok = renderLiveVisualOnCanvas(canvas, spec, { widthCss: 200, heightCss: 100 });
    expect(ok).toBe(true);
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
  });

  it("returns false when getContext returns null", () => {
    const spy = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const canvas = document.createElement("canvas");
    const spec = buildLiveVisualSpec(createInitialLiveSessionModelState("sid"), null);
    expect(renderLiveVisualOnCanvas(canvas, spec)).toBe(false);
    spy.mockRestore();
  });
});

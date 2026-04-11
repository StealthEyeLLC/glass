/**
 * jsdom does not implement Canvas 2D; stub `getContext("2d")` so live visual tests stay quiet and deterministic.
 */
import { vi } from "vitest";

function createMinimalCanvas2dMock(): CanvasRenderingContext2D {
  const c = document.createElement("canvas");
  return {
    canvas: c,
    fillStyle: "",
    strokeStyle: "",
    font: "",
    lineWidth: 1,
    setTransform: vi.fn(),
    setLineDash: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = function (
    this: HTMLCanvasElement,
    type: string,
  ): RenderingContext | null {
    if (type === "2d") {
      return createMinimalCanvas2dMock();
    }
    return null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

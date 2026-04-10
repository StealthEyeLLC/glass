/**
 * Live visual surface: Canvas 2D (full labels) vs WebGPU bootstrap (geometry only), honest fallback.
 */

import type { LiveVisualCanvasLayout } from "./liveVisualCanvas.js";
import { renderLiveVisualOnCanvas } from "./liveVisualCanvas.js";
import type { LiveVisualSpec } from "./liveVisualModel.js";
import type { LiveVisualWebGpuBundle } from "./liveVisualWebGpu.js";
import { renderLiveVisualWebGpuFrame } from "./liveVisualWebGpu.js";

export interface PaintLiveVisualSurfaceResult {
  /** True when either Canvas 2D drew successfully or WebGPU frame was shown. */
  fallbackTextShouldHide: boolean;
  /** True when WebGPU canvas is the visible surface for this frame. */
  webGpuActive: boolean;
}

const DEFAULT_LAYOUT: LiveVisualCanvasLayout = {
  widthCss: 360,
  heightCss: 132,
};

/**
 * Paints the bounded live visual. Prefers WebGPU when `bundle` is initialized and the frame succeeds;
 * otherwise Canvas 2D (includes text/honesty lines).
 */
export async function paintLiveVisualSurface(
  canvas2d: HTMLCanvasElement,
  canvasWebGpu: HTMLCanvasElement,
  spec: LiveVisualSpec,
  layout: LiveVisualCanvasLayout | undefined,
  webGpuBundle: LiveVisualWebGpuBundle | null,
): Promise<PaintLiveVisualSurfaceResult> {
  const lay = layout ?? DEFAULT_LAYOUT;
  if (webGpuBundle) {
    const okGpu = await renderLiveVisualWebGpuFrame(canvasWebGpu, spec, lay, webGpuBundle);
    if (okGpu) {
      canvasWebGpu.hidden = false;
      canvas2d.hidden = true;
      return { fallbackTextShouldHide: true, webGpuActive: true };
    }
  }
  canvasWebGpu.hidden = true;
  canvas2d.hidden = false;
  const ok2d = renderLiveVisualOnCanvas(canvas2d, spec, lay);
  return { fallbackTextShouldHide: ok2d, webGpuActive: false };
}

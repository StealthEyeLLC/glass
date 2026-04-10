/**
 * Live visual surface: WebGPU (geometry) + optional Canvas 2D text overlay, or full Canvas 2D, or WebGPU-only degraded to full Canvas if overlay fails.
 */

import type { LiveVisualCanvasLayout } from "./liveVisualCanvas.js";
import {
  renderLiveVisualOnCanvas,
  renderLiveVisualTextOverlayOnCanvas,
} from "./liveVisualCanvas.js";
import type { LiveVisualSpec } from "./liveVisualModel.js";
import type { LiveVisualWebGpuBundle } from "./liveVisualWebGpu.js";
import { renderLiveVisualWebGpuFrame } from "./liveVisualWebGpu.js";

export interface PaintLiveVisualSurfaceResult {
  /** True when either layer drew successfully enough to hide the “no canvas” fallback paragraph. */
  fallbackTextShouldHide: boolean;
  /** True when WebGPU canvas shows the geometry layer. */
  webGpuActive: boolean;
  /** True when the transparent text overlay canvas is visible (hybrid mode). */
  hybridTextOverlayActive: boolean;
}

const DEFAULT_LAYOUT: LiveVisualCanvasLayout = {
  widthCss: 360,
  heightCss: 132,
};

/**
 * Paints the bounded live visual. Prefers WebGPU geometry + Canvas text overlay when the bundle is initialized;
 * if WebGPU succeeds but the text overlay cannot be created, falls back to full Canvas 2D.
 */
export async function paintLiveVisualSurface(
  canvas2dFull: HTMLCanvasElement,
  canvasWebGpu: HTMLCanvasElement,
  canvasTextOverlay: HTMLCanvasElement,
  spec: LiveVisualSpec,
  layout: LiveVisualCanvasLayout | undefined,
  webGpuBundle: LiveVisualWebGpuBundle | null,
): Promise<PaintLiveVisualSurfaceResult> {
  const lay = layout ?? DEFAULT_LAYOUT;
  if (webGpuBundle) {
    const okGpu = await renderLiveVisualWebGpuFrame(canvasWebGpu, spec, lay, webGpuBundle);
    if (okGpu) {
      const okText = renderLiveVisualTextOverlayOnCanvas(canvasTextOverlay, spec, lay);
      if (okText) {
        canvasWebGpu.hidden = false;
        canvasTextOverlay.hidden = false;
        canvas2dFull.hidden = true;
        return {
          fallbackTextShouldHide: true,
          webGpuActive: true,
          hybridTextOverlayActive: true,
        };
      }
      canvasWebGpu.hidden = true;
      canvasTextOverlay.hidden = true;
      canvas2dFull.hidden = false;
      const ok2d = renderLiveVisualOnCanvas(canvas2dFull, spec, lay);
      return {
        fallbackTextShouldHide: ok2d,
        webGpuActive: false,
        hybridTextOverlayActive: false,
      };
    }
  }
  canvasWebGpu.hidden = true;
  canvasTextOverlay.hidden = true;
  canvas2dFull.hidden = false;
  const ok2d = renderLiveVisualOnCanvas(canvas2dFull, spec, lay);
  return {
    fallbackTextShouldHide: ok2d,
    webGpuActive: false,
    hybridTextOverlayActive: false,
  };
}

/**
 * Canvas 2D renderer for bounded live visual skeleton — no WebGPU in this pass.
 */

import {
  LIVE_VISUAL_MODE_FILL,
  type LiveVisualSpec,
  liveVisualDensity01,
} from "./liveVisualModel.js";

export interface LiveVisualCanvasLayout {
  widthCss: number;
  heightCss: number;
}

const DEFAULT_LAYOUT: LiveVisualCanvasLayout = {
  widthCss: 360,
  heightCss: 132,
};

/**
 * Draw the current spec in CSS pixel space. Caller must have applied any devicePixelRatio scaling
 * to `ctx` (e.g. `setTransform(dpr, 0, 0, dpr, 0, 0)`).
 */
export function renderLiveVisualIntoContext(
  ctx: CanvasRenderingContext2D,
  spec: LiveVisualSpec,
  widthCss: number,
  heightCss: number,
): void {
  const w = widthCss;
  const h = heightCss;

  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, 0, w, h);

  const bandColor = LIVE_VISUAL_MODE_FILL[spec.mode];
  const density = liveVisualDensity01(spec.eventTailCount);
  const bandW = 16 + density * (w - 32);
  const bandH = 28;
  const bandY = 16;
  ctx.fillStyle = bandColor;
  ctx.fillRect(16, bandY, bandW, bandH);

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(16, bandY, w - 32, bandH);

  ctx.fillStyle = "#0f172a";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillText(
    `mode=${spec.mode}  tail=${spec.eventTailCount}  session=${truncate(spec.sessionId, 28)}`,
    16,
    bandY + bandH + 16,
  );

  ctx.font = "400 11px system-ui, sans-serif";
  ctx.fillStyle = "#334155";
  const wire = spec.lastWireMsg
    ? `last wire: ${spec.lastWireMsg}`
    : "last wire: (none)";
  ctx.fillText(truncate(wire, 52), 16, bandY + bandH + 32);

  if (spec.reconcileSummary) {
    ctx.fillStyle = "#475569";
    ctx.fillText(truncate(`HTTP: ${spec.reconcileSummary}`, 58), 16, bandY + bandH + 48);
  }

  ctx.fillStyle = "#64748b";
  ctx.font = "400 10px system-ui, sans-serif";
  ctx.fillText(truncate(spec.honestyLine, 72), 16, h - 10);
}

/**
 * Draw the current spec. Returns false if 2D context is unavailable (caller may show fallback text).
 */
export function renderLiveVisualOnCanvas(
  canvas: HTMLCanvasElement,
  spec: LiveVisualSpec,
  layout: LiveVisualCanvasLayout = DEFAULT_LAYOUT,
): boolean {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    return false;
  }
  if (!ctx) {
    return false;
  }

  const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
  const w = layout.widthCss;
  const h = layout.heightCss;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  renderLiveVisualIntoContext(ctx, spec, w, h);

  return true;
}

function truncate(s: string, maxChars: number): string {
  if (s.length <= maxChars) {
    return s;
  }
  return `${s.slice(0, maxChars)}…`;
}

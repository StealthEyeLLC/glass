/**
 * Canvas 2D rendering for the bounded live visual.
 *
 * Responsibility split:
 * - **Geometry** (`renderLiveVisualGeometryIntoContext`): background, density band, ticks, HTTP chip box — matches WebGPU layer.
 * - **Text overlay** (`renderLiveVisualTextOverlayIntoContext`): mode / wire / reconcile / honesty lines + chip label — stacked transparently when WebGPU draws geometry.
 * - **Full** (`renderLiveVisualIntoContext` / `renderLiveVisualOnCanvas`): geometry + text (Canvas-only fallback).
 */

import {
  buildLiveVisualMarkersLayout,
  LIVE_VISUAL_BAND_LAYOUT,
  LIVE_VISUAL_TICK_GEOMETRY,
  LIVE_VISUAL_TICK_INACTIVE,
  liveVisualTickActiveFill,
} from "./liveVisualMarkers.js";
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
 * WebGPU-aligned geometry only (no text). Same layout math as `liveVisualWebGpu` vertex builder.
 */
export function renderLiveVisualGeometryIntoContext(
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
  const bandH = LIVE_VISUAL_BAND_LAYOUT.height;
  const bandY = LIVE_VISUAL_BAND_LAYOUT.originY;
  ctx.fillStyle = bandColor;
  ctx.fillRect(16, bandY, bandW, bandH);

  const markers = buildLiveVisualMarkersLayout(spec, w);
  const tickTop = bandY + LIVE_VISUAL_TICK_GEOMETRY.insetTop;
  const tickBot = bandY + bandH - LIVE_VISUAL_TICK_GEOMETRY.insetBottom;
  const tw = LIVE_VISUAL_TICK_GEOMETRY.widthPx;
  for (const t of markers.ticks) {
    ctx.fillStyle = t.active ? liveVisualTickActiveFill(t.kind) : LIVE_VISUAL_TICK_INACTIVE;
    ctx.fillRect(t.centerX - tw / 2, tickTop, tw, tickBot - tickTop);
  }

  const chip = markers.httpReconcile;
  if (chip.show) {
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(chip.x, chip.y, chip.width, chip.height);
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 1;
    ctx.strokeRect(chip.x, chip.y, chip.width, chip.height);
  }

  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.strokeRect(16, bandY, w - 32, bandH);
}

/**
 * Text + chip label only, no clear — use after geometry on the same context, or after clear on overlay.
 */
export function drawLiveVisualTextLabelsIntoContext(
  ctx: CanvasRenderingContext2D,
  spec: LiveVisualSpec,
  widthCss: number,
  heightCss: number,
): void {
  const w = widthCss;
  const h = heightCss;

  const markers = buildLiveVisualMarkersLayout(spec, w);
  const bandH = LIVE_VISUAL_BAND_LAYOUT.height;
  const bandY = LIVE_VISUAL_BAND_LAYOUT.originY;

  const chip = markers.httpReconcile;
  if (chip.show) {
    ctx.fillStyle = "#334155";
    ctx.font = "600 9px system-ui, sans-serif";
    ctx.fillText("HTTP", chip.x + 5, chip.y + 11);
  }

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
 * Transparent overlay: clear then text labels — hybrid WebGPU + Canvas (alpha canvas).
 */
export function renderLiveVisualTextOverlayIntoContext(
  ctx: CanvasRenderingContext2D,
  spec: LiveVisualSpec,
  widthCss: number,
  heightCss: number,
): void {
  const w = widthCss;
  const h = heightCss;
  ctx.clearRect(0, 0, w, h);
  drawLiveVisualTextLabelsIntoContext(ctx, spec, w, h);
}

/**
 * Full frame: geometry + text (Canvas-only path).
 */
export function renderLiveVisualIntoContext(
  ctx: CanvasRenderingContext2D,
  spec: LiveVisualSpec,
  widthCss: number,
  heightCss: number,
): void {
  renderLiveVisualGeometryIntoContext(ctx, spec, widthCss, heightCss);
  drawLiveVisualTextLabelsIntoContext(ctx, spec, widthCss, heightCss);
}

/**
 * Text overlay only. Returns false if 2D context is unavailable.
 */
export function renderLiveVisualTextOverlayOnCanvas(
  canvas: HTMLCanvasElement,
  spec: LiveVisualSpec,
  layout: LiveVisualCanvasLayout = DEFAULT_LAYOUT,
): boolean {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d", { alpha: true });
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

  renderLiveVisualTextOverlayIntoContext(ctx, spec, w, h);

  return true;
}

/**
 * Draw the current spec (full). Returns false if 2D context is unavailable (caller may show fallback text).
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

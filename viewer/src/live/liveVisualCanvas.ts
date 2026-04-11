/**
 * Canvas 2D rendering for the bounded live visual.
 *
 * Responsibility split:
 * - **Geometry** (`renderLiveVisualGeometryIntoContext`): consumes `DrawablePrimitive[]` from
 *   `buildBoundedVisualGeometryPrimitives` / `sceneToDrawablePrimitives` — same list as WebGPU.
 * - **Text overlay** (`renderLiveVisualTextOverlayIntoContext`): mode / wire / reconcile / honesty lines + chip label — stacked transparently when WebGPU draws geometry.
 * - **Full** (`renderLiveVisualIntoContext` / `renderLiveVisualOnCanvas`): geometry + text (Canvas-only fallback).
 */

import type { GlassSceneV0 } from "../scene/glassSceneV0.js";
import {
  buildBoundedVisualGeometryPrimitives,
  LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT,
  LIVE_VISUAL_STATE_RAIL_LAYOUT,
} from "../scene/drawablePrimitivesV0.js";
import { sceneToDrawablePrimitives } from "../scene/sceneToDrawablePrimitives.js";
import { liveVisualSpecFromScene } from "../scene/sceneToLiveVisualSpec.js";
import { buildLiveVisualMarkersLayout } from "./liveVisualMarkers.js";
import type { LiveVisualSpec } from "./liveVisualModel.js";

export interface LiveVisualCanvasLayout {
  widthCss: number;
  heightCss: number;
}

const DEFAULT_LAYOUT: LiveVisualCanvasLayout = {
  widthCss: 360,
  heightCss: 200,
};

/** Rasterize drawable primitives to a 2D context (CSS pixel space; caller sets DPR transform). */
export function renderDrawablePrimitivesToCanvas2D(
  ctx: CanvasRenderingContext2D,
  primitives: readonly DrawablePrimitive[],
): void {
  for (const p of primitives) {
    if (p.kind === "fill_rect") {
      ctx.fillStyle = p.fillColorHex;
      ctx.fillRect(p.x, p.y, p.width, p.height);
    } else {
      ctx.strokeStyle = p.strokeColorHex;
      ctx.lineWidth = p.lineWidthCss;
      ctx.strokeRect(p.x, p.y, p.width, p.height);
    }
  }
}

/**
 * WebGPU-aligned geometry only (no text). Same primitive list as `liveVisualWebGpu` vertex builder.
 */
export function renderLiveVisualGeometryIntoContext(
  ctx: CanvasRenderingContext2D,
  spec: LiveVisualSpec,
  widthCss: number,
  heightCss: number,
): void {
  const primitives = buildBoundedVisualGeometryPrimitives(spec, widthCss, heightCss);
  renderDrawablePrimitivesToCanvas2D(ctx, primitives);
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

  const chip = markers.httpReconcile;
  if (chip.show) {
    ctx.fillStyle = "#334155";
    ctx.font = "600 9px system-ui, sans-serif";
    ctx.fillText("HTTP", chip.x + 5, chip.y + 11);
  }

  const railBottom = LIVE_VISUAL_STATE_RAIL_LAYOUT.originY + LIVE_VISUAL_STATE_RAIL_LAYOUT.height;
  const clusterBottom =
    spec.actorClusterSummaryLine !== null && spec.actorClusterSummaryLine.length > 0
      ? LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT.originY + LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT.height
      : railBottom;
  let lineY = clusterBottom + 8;

  if (spec.boundedCompositionCaption) {
    ctx.font = "600 10px system-ui, sans-serif";
    ctx.fillStyle = "#0f766e";
    ctx.fillText(
      truncate(`composition: ${spec.boundedCompositionCaption}`, 58),
      16,
      lineY,
    );
    lineY += 14;
  }

  if (spec.actorClusterSummaryLine) {
    ctx.font = "500 10px system-ui, sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText(truncate(`clusters: ${spec.actorClusterSummaryLine}`, 58), 16, lineY);
    lineY += 14;
  }

  ctx.fillStyle = "#0f172a";
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillText(
    `mode=${spec.mode}  tail=${spec.eventTailCount}  session=${truncate(spec.sessionId, 28)}`,
    16,
    lineY,
  );
  lineY += 16;

  if (spec.stripSource === "live") {
    const origin = spec.snapshotOriginLabel ? truncate(spec.snapshotOriginLabel, 44) : "—";
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillStyle = "#1e3a8a";
    ctx.fillText(`snapshot_origin: ${origin}`, 16, lineY);
    lineY += 16;
  } else if (spec.replayPrefixFraction !== null) {
    const pct = Math.round(spec.replayPrefixFraction * 100);
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillStyle = "#1e3a8a";
    ctx.fillText(`replay prefix: ${pct}% of pack (index order)`, 16, lineY);
    lineY += 16;
  } else {
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.fillStyle = "#475569";
    ctx.fillText("replay: no prefix split (load / empty)", 16, lineY);
    lineY += 16;
  }

  ctx.font = "400 11px system-ui, sans-serif";
  ctx.fillStyle = "#334155";
  const wire = spec.lastWireMsg
    ? `last wire: ${spec.lastWireMsg}`
    : "last wire: (none)";
  ctx.fillText(truncate(wire, 52), 16, lineY);
  lineY += 16;

  if (spec.reconcileSummary) {
    ctx.fillStyle = "#475569";
    ctx.fillText(truncate(`HTTP: ${spec.reconcileSummary}`, 58), 16, lineY);
    lineY += 16;
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

function layoutForScene(
  scene: GlassSceneV0,
  layout: LiveVisualCanvasLayout | undefined,
): LiveVisualCanvasLayout {
  return layout ?? { widthCss: scene.bounds.widthCss, heightCss: scene.bounds.heightCss };
}

/**
 * Draw the current scene (geometry primitives + text). Returns false if 2D context is unavailable (caller may show fallback text).
 */
export function renderLiveVisualOnCanvas(
  canvas: HTMLCanvasElement,
  scene: GlassSceneV0,
  layout?: LiveVisualCanvasLayout,
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

  const lay = layoutForScene(scene, layout);
  const spec = liveVisualSpecFromScene(scene);
  const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
  const w = lay.widthCss;
  const h = lay.heightCss;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const primitives = sceneToDrawablePrimitives(scene, lay);
  renderDrawablePrimitivesToCanvas2D(ctx, primitives);
  drawLiveVisualTextLabelsIntoContext(ctx, spec, w, h);

  return true;
}

function truncate(s: string, maxChars: number): string {
  if (s.length <= maxChars) {
    return s;
  }
  return `${s.slice(0, maxChars)}…`;
}

/**
 * Drawable Primitives v0 — pure, deterministic, DOM-free geometry for the bounded live/replay strip.
 * Semantic layout is delegated to `LiveVisualSpec` + `buildLiveVisualMarkersLayout`; this layer is the
 * single rasterization-facing list (Canvas 2D and WebGPU consume the same sequence).
 */

import {
  buildLiveVisualMarkersLayout,
  LIVE_VISUAL_BAND_LAYOUT,
  LIVE_VISUAL_TICK_GEOMETRY,
  LIVE_VISUAL_TICK_INACTIVE,
  liveVisualTickActiveFill,
} from "../live/liveVisualMarkers.js";
import {
  LIVE_VISUAL_MODE_FILL,
  type LiveVisualSpec,
  liveVisualDensity01,
} from "../live/liveVisualModel.js";

export const DRAWABLE_PRIMITIVES_V0 = "glass.drawable_primitives.v0" as const;

export type DrawablePrimitiveKind = "fill_rect" | "stroke_rect";

/** Axis-aligned solid fill (CSS px, sRGB hex fill). */
export interface DrawablePrimitiveFillRect {
  kind: "fill_rect";
  x: number;
  y: number;
  width: number;
  height: number;
  /** `#rrggbb` */
  fillColorHex: string;
}

/** Axis-aligned stroke frame (CSS px); Canvas uses `strokeRect`; WebGPU expands to thin fill quads. */
export interface DrawablePrimitiveStrokeRect {
  kind: "stroke_rect";
  x: number;
  y: number;
  width: number;
  height: number;
  /** `#rrggbb` */
  strokeColorHex: string;
  lineWidthCss: number;
}

export type DrawablePrimitive = DrawablePrimitiveFillRect | DrawablePrimitiveStrokeRect;

/**
 * Bounded strip geometry: background, mode-colored density band, R/A/Rz ticks, optional HTTP chip, band frame.
 * Order is stable for deterministic tests and matched across backends.
 */
export function buildBoundedVisualGeometryPrimitives(
  spec: LiveVisualSpec,
  widthCss: number,
  heightCss: number,
): DrawablePrimitive[] {
  const w = widthCss;
  const h = heightCss;
  const out: DrawablePrimitive[] = [];

  out.push({
    kind: "fill_rect",
    x: 0,
    y: 0,
    width: w,
    height: h,
    fillColorHex: "#f1f5f9",
  });

  const bandColor = LIVE_VISUAL_MODE_FILL[spec.mode];
  const density = liveVisualDensity01(spec.eventTailCount);
  const bandW = 16 + density * (w - 32);
  const bandH = LIVE_VISUAL_BAND_LAYOUT.height;
  const bandY = LIVE_VISUAL_BAND_LAYOUT.originY;
  out.push({
    kind: "fill_rect",
    x: 16,
    y: bandY,
    width: bandW,
    height: bandH,
    fillColorHex: bandColor,
  });

  const markers = buildLiveVisualMarkersLayout(spec, w);
  const tickTop = bandY + LIVE_VISUAL_TICK_GEOMETRY.insetTop;
  const tickBot = bandY + bandH - LIVE_VISUAL_TICK_GEOMETRY.insetBottom;
  const tw = LIVE_VISUAL_TICK_GEOMETRY.widthPx;
  for (const t of markers.ticks) {
    const fill = t.active ? liveVisualTickActiveFill(t.kind) : LIVE_VISUAL_TICK_INACTIVE;
    out.push({
      kind: "fill_rect",
      x: t.centerX - tw / 2,
      y: tickTop,
      width: tw,
      height: tickBot - tickTop,
      fillColorHex: fill,
    });
  }

  const chip = markers.httpReconcile;
  if (chip.show) {
    out.push({
      kind: "fill_rect",
      x: chip.x,
      y: chip.y,
      width: chip.width,
      height: chip.height,
      fillColorHex: "#f8fafc",
    });
    out.push({
      kind: "stroke_rect",
      x: chip.x,
      y: chip.y,
      width: chip.width,
      height: chip.height,
      strokeColorHex: "#64748b",
      lineWidthCss: 1,
    });
  }

  out.push({
    kind: "stroke_rect",
    x: 16,
    y: bandY,
    width: w - 32,
    height: bandH,
    strokeColorHex: "#cbd5e1",
    lineWidthCss: 1,
  });

  return out;
}

/**
 * Expand a stroke rectangle into axis-aligned fill rectangles (for WebGPU solid-color pipeline).
 */
export function expandStrokeRectToFillRects(s: DrawablePrimitiveStrokeRect): DrawablePrimitiveFillRect[] {
  const { x, y, width, height, strokeColorHex, lineWidthCss } = s;
  const lw = Math.max(1, lineWidthCss);
  if (width <= 0 || height <= 0) {
    return [];
  }
  const innerH = Math.max(0, height - 2 * lw);
  const c = strokeColorHex;
  return [
    { kind: "fill_rect", x, y, width, height: lw, fillColorHex: c },
    { kind: "fill_rect", x, y: y + height - lw, width, height: lw, fillColorHex: c },
    { kind: "fill_rect", x, y: y + lw, width: lw, height: innerH, fillColorHex: c },
    { kind: "fill_rect", x: x + width - lw, y: y + lw, width: lw, height: innerH, fillColorHex: c },
  ];
}

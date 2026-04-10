/**
 * Drawable Primitives v0 — pure, deterministic, DOM-free geometry for the bounded live/replay strip.
 * Semantic layout is delegated to `LiveVisualSpec` + `buildLiveVisualMarkersLayout`; this layer is the
 * single rasterization-facing list (Canvas 2D and WebGPU consume the same sequence).
 *
 * **`semanticTag`** is inspectable intent for tests/tooling — it does not add visual claims beyond
 * existing strip semantics; renderers ignore it for drawing.
 */

import type { LiveVisualTickKind } from "../live/liveVisualMarkers.js";
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

/** Y offset and height for the bounded state rail (below primary band + ticks; matches canvas text layout). */
export const LIVE_VISUAL_STATE_RAIL_LAYOUT = {
  originY: 52,
  height: 20,
  insetX: 16,
} as const;

/**
 * Stable, renderer-agnostic labels for bounded-strip geometry. Tags reflect existing layout roles
 * (background, density band, wire-slot ticks, HTTP chip, outer band frame) — not topology or history.
 */
export type DrawablePrimitiveSemanticTag =
  | "band_background"
  | "density_band"
  | "tick_slot_replace"
  | "tick_slot_append"
  | "tick_slot_resync"
  | "http_chip_fill"
  /** Logical chip border; Canvas draws one stroke; WebGPU expands to `http_chip_frame_*` edge fills. */
  | "http_chip_frame"
  /** Logical band outer stroke; Canvas draws one stroke; WebGPU expands to `band_frame_*` edge fills. */
  | "band_frame"
  | "band_frame_top"
  | "band_frame_bottom"
  | "band_frame_left"
  | "band_frame_right"
  | "http_chip_frame_top"
  | "http_chip_frame_bottom"
  | "http_chip_frame_left"
  | "http_chip_frame_right"
  /** Vertical Slice v1 — bounded state rail under the primary band (not topology). */
  | "state_rail_bg"
  | "state_rail_snapshot_lane"
  | "state_rail_resync_lane"
  | "state_rail_warning_lane"
  | "replay_prefix_lane"
  | "replay_remainder_lane"
  | "state_rail_frame"
  | "state_rail_frame_top"
  | "state_rail_frame_bottom"
  | "state_rail_frame_left"
  | "state_rail_frame_right";

export type DrawablePrimitiveKind = "fill_rect" | "stroke_rect";

/** Axis-aligned solid fill (CSS px, sRGB hex fill). */
export interface DrawablePrimitiveFillRect {
  kind: "fill_rect";
  semanticTag: DrawablePrimitiveSemanticTag;
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
  semanticTag: DrawablePrimitiveSemanticTag;
  x: number;
  y: number;
  width: number;
  height: number;
  /** `#rrggbb` */
  strokeColorHex: string;
  lineWidthCss: number;
}

export type DrawablePrimitive = DrawablePrimitiveFillRect | DrawablePrimitiveStrokeRect;

function tickKindToSemanticTag(kind: LiveVisualTickKind): DrawablePrimitiveSemanticTag {
  switch (kind) {
    case "replace":
      return "tick_slot_replace";
    case "append":
      return "tick_slot_append";
    case "resync_wire":
      return "tick_slot_resync";
  }
}

/**
 * WebGPU stroke expansion: four edge fills in top → bottom → left → right order (matches `expandStrokeRectToFillRects`).
 */
export function edgeFrameTagsForStroke(
  tag: DrawablePrimitiveSemanticTag,
): readonly [
  DrawablePrimitiveSemanticTag,
  DrawablePrimitiveSemanticTag,
  DrawablePrimitiveSemanticTag,
  DrawablePrimitiveSemanticTag,
] {
  if (tag === "http_chip_frame") {
    return [
      "http_chip_frame_top",
      "http_chip_frame_bottom",
      "http_chip_frame_left",
      "http_chip_frame_right",
    ];
  }
  if (tag === "state_rail_frame") {
    return [
      "state_rail_frame_top",
      "state_rail_frame_bottom",
      "state_rail_frame_left",
      "state_rail_frame_right",
    ];
  }
  return ["band_frame_top", "band_frame_bottom", "band_frame_left", "band_frame_right"];
}

/**
 * Bounded strip geometry: background, mode-colored density band, R/A/Rz ticks, optional HTTP chip, band frame.
 * Order is stable for deterministic tests and matched across backends:
 *
 * 1. `band_background` → 2. `density_band` → 3–5. tick slots (replace, append, resync order) →
 * optional `http_chip_fill` + `http_chip_frame` → 6. `band_frame` → 7+. Vertical Slice v1 state rail
 * (`state_rail_*`, `replay_*` lanes, `state_rail_frame`).
 */
function appendVerticalSliceStateRail(spec: LiveVisualSpec, widthCss: number, out: DrawablePrimitive[]): void {
  const inset = LIVE_VISUAL_STATE_RAIL_LAYOUT.insetX;
  const innerW = widthCss - 2 * inset;
  const y = LIVE_VISUAL_STATE_RAIL_LAYOUT.originY;
  const h = LIVE_VISUAL_STATE_RAIL_LAYOUT.height;
  const gap = 2;

  out.push({
    kind: "fill_rect",
    semanticTag: "state_rail_bg",
    x: inset,
    y,
    width: innerW,
    height: h,
    fillColorHex: "#e2e8f0",
  });

  const innerX = inset + gap;
  const innerY = y + gap;
  const innerW2 = innerW - 2 * gap;
  const innerH = h - 2 * gap;

  if (spec.stripSource === "replay") {
    if (spec.replayPrefixFraction !== null) {
      const frac = Math.min(1, Math.max(0, spec.replayPrefixFraction));
      const prefixW = innerW2 * frac;
      const remW = Math.max(0, innerW2 - prefixW);
      if (prefixW > 0) {
        out.push({
          kind: "fill_rect",
          semanticTag: "replay_prefix_lane",
          x: innerX,
          y: innerY,
          width: prefixW,
          height: innerH,
          fillColorHex: LIVE_VISUAL_MODE_FILL.replace,
        });
      }
      if (remW > 0) {
        out.push({
          kind: "fill_rect",
          semanticTag: "replay_remainder_lane",
          x: innerX + prefixW,
          y: innerY,
          width: remW,
          height: innerH,
          fillColorHex: "#cbd5e1",
        });
      }
    } else {
      out.push({
        kind: "fill_rect",
        semanticTag: "replay_remainder_lane",
        x: innerX,
        y: innerY,
        width: innerW2,
        height: innerH,
        fillColorHex: "#94a3b8",
      });
    }
  } else {
    const third = (innerW2 - 2 * gap) / 3;
    const w1 = third;
    const w2 = third;
    const w3 = innerW2 - w1 - w2 - 2 * gap;

    const hasOrigin =
      spec.snapshotOriginLabel !== null &&
      spec.snapshotOriginLabel !== undefined &&
      String(spec.snapshotOriginLabel).length > 0;

    out.push({
      kind: "fill_rect",
      semanticTag: "state_rail_snapshot_lane",
      x: innerX,
      y: innerY,
      width: w1,
      height: innerH,
      fillColorHex: hasOrigin ? "#93c5fd" : "#f1f5f9",
    });
    const resyncActive = spec.mode === "resync" || (spec.resyncReason !== null && spec.resyncReason.length > 0);
    out.push({
      kind: "fill_rect",
      semanticTag: "state_rail_resync_lane",
      x: innerX + w1 + gap,
      y: innerY,
      width: w2,
      height: innerH,
      fillColorHex: resyncActive ? "#fdba74" : "#f1f5f9",
    });
    const warnActive =
      spec.mode === "warning" || (spec.warningCode !== null && spec.warningCode.length > 0);
    out.push({
      kind: "fill_rect",
      semanticTag: "state_rail_warning_lane",
      x: innerX + w1 + gap + w2 + gap,
      y: innerY,
      width: w3,
      height: innerH,
      fillColorHex: warnActive ? "#fca5a5" : "#f1f5f9",
    });
  }

  out.push({
    kind: "stroke_rect",
    semanticTag: "state_rail_frame",
    x: inset,
    y,
    width: innerW,
    height: h,
    strokeColorHex: "#64748b",
    lineWidthCss: 1,
  });
}

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
    semanticTag: "band_background",
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
    semanticTag: "density_band",
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
      semanticTag: tickKindToSemanticTag(t.kind),
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
      semanticTag: "http_chip_fill",
      x: chip.x,
      y: chip.y,
      width: chip.width,
      height: chip.height,
      fillColorHex: "#f8fafc",
    });
    out.push({
      kind: "stroke_rect",
      semanticTag: "http_chip_frame",
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
    semanticTag: "band_frame",
    x: 16,
    y: bandY,
    width: w - 32,
    height: bandH,
    strokeColorHex: "#cbd5e1",
    lineWidthCss: 1,
  });

  appendVerticalSliceStateRail(spec, w, out);

  return out;
}

/**
 * Expand a stroke rectangle into axis-aligned fill rectangles (for WebGPU solid-color pipeline).
 * Edge tags are derived from `stroke.semanticTag` via `edgeFrameTagsForStroke` (`band_frame`, `http_chip_frame`, or `state_rail_frame`).
 */
export function expandStrokeRectToFillRects(s: DrawablePrimitiveStrokeRect): DrawablePrimitiveFillRect[] {
  const { x, y, width, height, strokeColorHex, lineWidthCss, semanticTag } = s;
  const lw = Math.max(1, lineWidthCss);
  if (width <= 0 || height <= 0) {
    return [];
  }
  const innerH = Math.max(0, height - 2 * lw);
  const c = strokeColorHex;
  const [topTag, bottomTag, leftTag, rightTag] = edgeFrameTagsForStroke(semanticTag);
  return [
    { kind: "fill_rect", semanticTag: topTag, x, y, width, height: lw, fillColorHex: c },
    {
      kind: "fill_rect",
      semanticTag: bottomTag,
      x,
      y: y + height - lw,
      width,
      height: lw,
      fillColorHex: c,
    },
    {
      kind: "fill_rect",
      semanticTag: leftTag,
      x,
      y: y + lw,
      width: lw,
      height: innerH,
      fillColorHex: c,
    },
    {
      kind: "fill_rect",
      semanticTag: rightTag,
      x: x + width - lw,
      y: y + lw,
      width: lw,
      height: innerH,
      fillColorHex: c,
    },
  ];
}

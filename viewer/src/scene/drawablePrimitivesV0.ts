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
import type { GlassSceneV0, SceneActorCluster, SceneActorClusterLane } from "./glassSceneV0.js";

export const DRAWABLE_PRIMITIVES_V0 = "glass.drawable_primitives.v0" as const;

/** Y offset and height for the bounded state rail (below primary band + ticks; matches canvas text layout). */
export const LIVE_VISUAL_STATE_RAIL_LAYOUT = {
  originY: 52,
  height: 20,
  insetX: 16,
} as const;

/** Vertical Slice v2 — bounded actor cluster strip (below state rail). */
export const LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT = {
  originY: 74,
  height: 22,
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
  | "state_rail_frame_right"
  /** Vertical Slice v2 — bounded actor/sample cluster strip (not topology). */
  | "actor_cluster_strip_bg"
  | "actor_cluster_segment_system"
  | "actor_cluster_segment_process"
  | "actor_cluster_segment_file"
  | "actor_cluster_segment_snapshot"
  | "actor_cluster_segment_replay_prefix"
  | "actor_cluster_segment_empty"
  /** Shared tag for emphasis bar inside a lane (paired with lane segment fill above). */
  | "actor_cluster_emphasis_bar"
  | "actor_cluster_strip_frame"
  | "actor_cluster_strip_frame_top"
  | "actor_cluster_strip_frame_bottom"
  | "actor_cluster_strip_frame_left"
  | "actor_cluster_strip_frame_right"
  /** Vertical Slice v3 — bounded region panels / accents (grouping, not graph edges). */
  | "composition_panel_primary"
  | "composition_panel_system"
  | "composition_panel_evidence"
  | "composition_accent_primary"
  | "composition_accent_system"
  | "composition_accent_evidence"
  | "composition_separator_system_evidence"
  /** Outer bounded-scene frame; WebGPU expands to `composition_bounded_scene_frame_*` edge fills. */
  | "composition_bounded_scene_frame"
  | "composition_bounded_scene_frame_top"
  | "composition_bounded_scene_frame_bottom"
  | "composition_bounded_scene_frame_left"
  | "composition_bounded_scene_frame_right"
  /** Vertical Slice v4 — bounded pulse/flash overlays (state-change-driven, not idle animation). */
  | "emphasis_wire_pulse_overlay"
  | "emphasis_sample_pulse_overlay"
  | "emphasis_replay_cursor_pulse_overlay"
  | "emphasis_resync_flash_overlay"
  | "emphasis_system_flash_overlay"
  | "emphasis_state_rail_attention_overlay"
  /** Vertical Slice v6 — bounded focus highlight strokes (grouping, not graph edges). */
  | "focus_region_selection_frame"
  | "focus_cluster_selection_frame";

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
  if (tag === "actor_cluster_strip_frame") {
    return [
      "actor_cluster_strip_frame_top",
      "actor_cluster_strip_frame_bottom",
      "actor_cluster_strip_frame_left",
      "actor_cluster_strip_frame_right",
    ];
  }
  if (tag === "composition_bounded_scene_frame") {
    return [
      "composition_bounded_scene_frame_top",
      "composition_bounded_scene_frame_bottom",
      "composition_bounded_scene_frame_left",
      "composition_bounded_scene_frame_right",
    ];
  }
  if (tag === "focus_region_selection_frame" || tag === "focus_cluster_selection_frame") {
    return [
      "band_frame_top",
      "band_frame_bottom",
      "band_frame_left",
      "band_frame_right",
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

function actorClusterLaneSemanticTag(lane: SceneActorClusterLane): DrawablePrimitiveSemanticTag {
  switch (lane) {
    case "system_attention":
      return "actor_cluster_segment_system";
    case "process_samples":
      return "actor_cluster_segment_process";
    case "file_samples":
      return "actor_cluster_segment_file";
    case "snapshot_origin":
      return "actor_cluster_segment_snapshot";
    case "replay_index_prefix":
      return "actor_cluster_segment_replay_prefix";
    case "empty_sample":
      return "actor_cluster_segment_empty";
  }
}

function actorClusterLaneMutedFill(lane: SceneActorClusterLane): string {
  switch (lane) {
    case "system_attention":
      return "#fee2e2";
    case "process_samples":
      return "#e0f2fe";
    case "file_samples":
      return "#fef9c3";
    case "snapshot_origin":
      return "#ede9fe";
    case "replay_index_prefix":
      return "#e0f7ff";
    case "empty_sample":
      return "#f1f5f9";
  }
}

function actorClusterLaneEmphasisFill(lane: SceneActorClusterLane): string {
  switch (lane) {
    case "system_attention":
      return "#dc2626";
    case "process_samples":
      return "#0284c7";
    case "file_samples":
      return "#ca8a04";
    case "snapshot_origin":
      return "#7c3aed";
    case "replay_index_prefix":
      return "#0369a1";
    case "empty_sample":
      return "#94a3b8";
  }
}

/**
 * Vertical Slice v2 — bounded actor cluster strip (after state rail). Same primitive stream as Canvas/WebGPU.
 */
export function appendBoundedActorClusterStrip(
  clusters: readonly SceneActorCluster[],
  widthCss: number,
  out: DrawablePrimitive[],
): void {
  if (clusters.length === 0) {
    return;
  }
  const inset = LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT.insetX;
  const y = LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT.originY;
  const h = LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT.height;
  const innerW = widthCss - 2 * inset;
  const pad = 2;
  const gap = 2;
  const n = clusters.length;
  const innerW2 = innerW - 2 * pad;
  const segW = (innerW2 - (n - 1) * gap) / n;
  const innerY = y + pad;
  const innerH = h - 2 * pad;

  out.push({
    kind: "fill_rect",
    semanticTag: "actor_cluster_strip_bg",
    x: inset,
    y,
    width: innerW,
    height: h,
    fillColorHex: "#f8fafc",
  });

  let x = inset + pad;
  for (const c of clusters) {
    const tag = actorClusterLaneSemanticTag(c.lane);
    out.push({
      kind: "fill_rect",
      semanticTag: tag,
      x,
      y: innerY,
      width: segW,
      height: innerH,
      fillColorHex: actorClusterLaneMutedFill(c.lane),
    });
    const emH = Math.max(2, innerH * c.emphasis01);
    out.push({
      kind: "fill_rect",
      semanticTag: "actor_cluster_emphasis_bar",
      x,
      y: innerY + innerH - emH,
      width: segW,
      height: emH,
      fillColorHex: actorClusterLaneEmphasisFill(c.lane),
    });
    x += segW + gap;
  }

  out.push({
    kind: "stroke_rect",
    semanticTag: "actor_cluster_strip_frame",
    x: inset,
    y,
    width: innerW,
    height: h,
    strokeColorHex: "#64748b",
    lineWidthCss: 1,
  });
}

const COMPOSITION_INSET = 16;
const COMPOSITION_ACCENT_X = 8;
const COMPOSITION_ACCENT_W = 3;

function emphasisPulseHex(step: 0 | 1 | 2 | 3): string | null {
  if (step <= 0) {
    return null;
  }
  if (step === 1) {
    return "#fffbeb";
  }
  if (step === 2) {
    return "#fef3c7";
  }
  return "#fde68a";
}

function railResyncHex(step: 0 | 1 | 2 | 3): string | null {
  if (step <= 0) {
    return null;
  }
  if (step === 1) {
    return "#ffedd5";
  }
  if (step === 2) {
    return "#fed7aa";
  }
  return "#fdba74";
}

function railSystemHex(step: 0 | 1 | 2 | 3): string | null {
  if (step <= 0) {
    return null;
  }
  if (step === 1) {
    return "#fee2e2";
  }
  if (step === 2) {
    return "#fecaca";
  }
  return "#fca5a5";
}

function primaryPanelHex(w: number): string {
  if (w >= 0.52) {
    return "#eff6ff";
  }
  return "#f8fafc";
}

function systemPanelHex(w: number): string {
  if (w >= 0.48) {
    return "#e8eef5";
  }
  return "#eef2f6";
}

function evidencePanelHex(w: number): string {
  if (w >= 0.3) {
    return "#ecfdf5";
  }
  return "#f0fdf4";
}

/**
 * Vertical Slice v3 — insert underlay panels / accents / separator before existing strip primitives,
 * then append an outer bounded-scene frame stroke. Uses only `scene.regions.length` as gate; geometry
 * aligns to fixed band/rail/cluster layout constants. No graph edges.
 */
export function applyBoundedSceneComposition(
  scene: GlassSceneV0,
  widthCss: number,
  heightCss: number,
  out: DrawablePrimitive[],
): void {
  if (scene.regions.length === 0) {
    return;
  }
  const w = widthCss;
  const innerW = w - 2 * COMPOSITION_INSET;
  const em = scene.emphasis;

  const primaryY = LIVE_VISUAL_BAND_LAYOUT.originY;
  const primaryH = LIVE_VISUAL_BAND_LAYOUT.height;
  const systemY = LIVE_VISUAL_STATE_RAIL_LAYOUT.originY;
  const systemH = LIVE_VISUAL_STATE_RAIL_LAYOUT.height;
  const evidenceY = LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT.originY;
  const evidenceH = LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT.height;

  const bgIdx = out.findIndex((p) => p.semanticTag === "band_background");
  if (bgIdx >= 0) {
    out.splice(
      bgIdx + 1,
      0,
      {
        kind: "fill_rect",
        semanticTag: "composition_panel_primary",
        x: COMPOSITION_INSET,
        y: primaryY,
        width: innerW,
        height: primaryH,
        fillColorHex: primaryPanelHex(em.regionWeightPrimary),
      },
      {
        kind: "fill_rect",
        semanticTag: "composition_accent_primary",
        x: COMPOSITION_ACCENT_X,
        y: primaryY,
        width: COMPOSITION_ACCENT_W,
        height: primaryH,
        fillColorHex: "#3b82f6",
      },
    );
  }

  const railIdx = out.findIndex((p) => p.semanticTag === "state_rail_bg");
  if (railIdx >= 0) {
    out.splice(
      railIdx,
      0,
      {
        kind: "fill_rect",
        semanticTag: "composition_panel_system",
        x: COMPOSITION_INSET,
        y: systemY,
        width: innerW,
        height: systemH,
        fillColorHex: systemPanelHex(em.regionWeightSystem),
      },
      {
        kind: "fill_rect",
        semanticTag: "composition_accent_system",
        x: COMPOSITION_ACCENT_X,
        y: systemY,
        width: COMPOSITION_ACCENT_W,
        height: systemH,
        fillColorHex: "#64748b",
      },
    );
  }

  const clusterIdx = out.findIndex((p) => p.semanticTag === "actor_cluster_strip_bg");
  if (clusterIdx >= 0) {
    const sepY = systemY + systemH;
    out.splice(
      clusterIdx,
      0,
      {
        kind: "fill_rect",
        semanticTag: "composition_separator_system_evidence",
        x: COMPOSITION_INSET,
        y: sepY,
        width: innerW,
        height: 1,
        fillColorHex: "#cbd5e1",
      },
      {
        kind: "fill_rect",
        semanticTag: "composition_panel_evidence",
        x: COMPOSITION_INSET,
        y: evidenceY,
        width: innerW,
        height: evidenceH,
        fillColorHex: evidencePanelHex(em.regionWeightEvidence),
      },
      {
        kind: "fill_rect",
        semanticTag: "composition_accent_evidence",
        x: COMPOSITION_ACCENT_X,
        y: evidenceY,
        width: COMPOSITION_ACCENT_W,
        height: evidenceH,
        fillColorHex: "#15803d",
      },
    );
  }

  out.push({
    kind: "stroke_rect",
    semanticTag: "composition_bounded_scene_frame",
    x: 0,
    y: 0,
    width: widthCss,
    height: heightCss,
    strokeColorHex: "#94a3b8",
    lineWidthCss: 1,
  });
}

/**
 * Vertical Slice v4 — pulse/flash overlays before the outer composition frame (same primitive stream as Canvas/WebGPU).
 */
export function applyBoundedEmphasisOverlays(
  scene: GlassSceneV0,
  widthCss: number,
  heightCss: number,
  out: DrawablePrimitive[],
): void {
  void heightCss;
  const e = scene.emphasis;
  const frameIdx = out.findIndex((p) => p.semanticTag === "composition_bounded_scene_frame");
  const insertAt = frameIdx >= 0 ? frameIdx : out.length;
  const w = widthCss;
  const bandY = LIVE_VISUAL_BAND_LAYOUT.originY;
  const bandH = LIVE_VISUAL_BAND_LAYOUT.height;
  const inset = LIVE_VISUAL_STATE_RAIL_LAYOUT.insetX;
  const railY = LIVE_VISUAL_STATE_RAIL_LAYOUT.originY;
  const railH = LIVE_VISUAL_STATE_RAIL_LAYOUT.height;
  const innerW = w - 2 * inset;
  const inserts: DrawablePrimitive[] = [];

  const wTint = emphasisPulseHex(e.wirePulseStep);
  if (wTint) {
    inserts.push({
      kind: "fill_rect",
      semanticTag: "emphasis_wire_pulse_overlay",
      x: 16,
      y: bandY,
      width: w - 32,
      height: bandH,
      fillColorHex: wTint,
    });
  }
  const sTint = emphasisPulseHex(e.samplePulseStep);
  if (sTint) {
    inserts.push({
      kind: "fill_rect",
      semanticTag: "emphasis_sample_pulse_overlay",
      x: 16,
      y: bandY,
      width: w - 32,
      height: bandH,
      fillColorHex: sTint,
    });
  }
  if (e.replayCursorPulseStep > 0 && scene.source === "replay") {
    const cp = e.replayCursorPulseStep === 1 ? "#ecfccb" : "#d9f99d";
    inserts.push({
      kind: "fill_rect",
      semanticTag: "emphasis_replay_cursor_pulse_overlay",
      x: 16,
      y: bandY,
      width: w - 32,
      height: bandH,
      fillColorHex: cp,
    });
  }

  const rs = e.resyncFlashStep;
  const ss = e.systemFlashStep;
  if (rs > 0 || ss > 0) {
    const preferResync = rs >= ss;
    const hex = preferResync ? railResyncHex(rs) : railSystemHex(ss);
    if (hex) {
      inserts.push({
        kind: "fill_rect",
        semanticTag: "emphasis_state_rail_attention_overlay",
        x: inset,
        y: railY,
        width: innerW,
        height: railH,
        fillColorHex: hex,
      });
    }
  }

  if (inserts.length > 0) {
    out.splice(insertAt, 0, ...inserts);
  }
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
 * Edge tags are derived from `stroke.semanticTag` via `edgeFrameTagsForStroke` (`band_frame`, `http_chip_frame`, `state_rail_frame`, `actor_cluster_strip_frame`, or `composition_bounded_scene_frame`).
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

/**
 * Pure layout for bounded live visual markers — ticks for last replace / append / resync wire,
 * plus optional HTTP reconcile chip. No canvas, no timing, no topology.
 *
 * Only one of the three wire ticks is active at a time (matches `LiveVisualSpec.mode` from
 * `lastAppliedWire`). HTTP chip reflects presence of a bounded HTTP reconcile record line.
 */

import type { LiveVisualSpec } from "./liveVisualModel.js";
import { LIVE_VISUAL_MODE_FILL } from "./liveVisualModel.js";

export const LIVE_VISUAL_BAND_LAYOUT = {
  originX: 16,
  originY: 16,
  height: 28,
} as const;

/** Inactive tick color (dimmed; does not imply a historical event at that slot). */
export const LIVE_VISUAL_TICK_INACTIVE = "#e2e8f0";

export type LiveVisualTickKind = "replace" | "append" | "resync_wire";

export interface LiveVisualBandTick {
  kind: LiveVisualTickKind;
  /** Center X in CSS pixels (deterministic given width). */
  centerX: number;
  /** Exactly one tick active when mode matches; none active for hello / idle / none_delta / warning / etc. */
  active: boolean;
}

export interface LiveVisualHttpReconcileChip {
  show: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LiveVisualMarkersLayout {
  ticks: LiveVisualBandTick[];
  httpReconcile: LiveVisualHttpReconcileChip;
}

const HTTP_CHIP_W = 44;
const HTTP_CHIP_H = 14;

/**
 * Map live visual spec → marker positions. `widthCss` must match the canvas CSS width used for rendering.
 */
export function buildLiveVisualMarkersLayout(
  spec: LiveVisualSpec,
  widthCss: number,
): LiveVisualMarkersLayout {
  const bandX = LIVE_VISUAL_BAND_LAYOUT.originX;
  const bandInnerW = widthCss - 32;
  const third = bandInnerW / 3;
  const cxReplace = bandX + third * 0.5;
  const cxAppend = bandX + third * 1.5;
  const cxResync = bandX + third * 2.5;

  const ticks: LiveVisualBandTick[] = [
    { kind: "replace", centerX: cxReplace, active: spec.mode === "replace" },
    { kind: "append", centerX: cxAppend, active: spec.mode === "append" },
    { kind: "resync_wire", centerX: cxResync, active: spec.mode === "resync" },
  ];

  return {
    ticks,
    httpReconcile: {
      show: spec.reconcileSummary !== null,
      x: widthCss - bandX - HTTP_CHIP_W,
      y: LIVE_VISUAL_BAND_LAYOUT.originY + 2,
      width: HTTP_CHIP_W,
      height: HTTP_CHIP_H,
    },
  };
}

/** Active tick stroke/fill color per kind (matches band mode palette). */
export function liveVisualTickActiveFill(kind: LiveVisualTickKind): string {
  switch (kind) {
    case "replace":
      return LIVE_VISUAL_MODE_FILL.replace;
    case "append":
      return LIVE_VISUAL_MODE_FILL.append;
    case "resync_wire":
      return LIVE_VISUAL_MODE_FILL.resync;
  }
}

/** Vertical ticks on the band: inset from band top/bottom, width in CSS px. */
export const LIVE_VISUAL_TICK_GEOMETRY = {
  insetTop: 5,
  insetBottom: 5,
  widthPx: 2,
} as const;

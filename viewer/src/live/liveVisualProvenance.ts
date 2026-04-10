/**
 * Pure derived provenance for the bounded live visual — operator-facing, no invented topology.
 */

import type { HttpReconcileRecord } from "./liveHttpReconcile.js";
import type { LiveVisualMode, LiveVisualSpec } from "./liveVisualModel.js";
import type { BoundedSnapshotF04 } from "./liveSessionHttp.js";
import type { PaintLiveVisualSurfaceResult } from "./liveVisualRenderer.js";
import type { WebGpuLiveStatus } from "./liveWebGpuProbe.js";

/** Canonical renderer labels for the provenance strip (matches mission wording). */
export type LiveVisualRendererModeLabel =
  | "hybrid"
  | "canvas_only"
  | "webgpu_failed_with_fallback"
  | "webgpu_unavailable";

/** Why full Canvas 2d is shown when probe says WebGPU initialized (honest sub-state). */
export type CanvasOnlyGpuSubdetail = "none" | "gpu_frame_or_overlay_failed" | "pending_or_no_bundle";

export interface LiveVisualProvenanceStrip {
  rendererMode: LiveVisualRendererModeLabel;
  canvasOnlyGpuSubdetail: CanvasOnlyGpuSubdetail;
  /** Bounded visual wire/update mode (from `LiveVisualSpec.mode`). */
  wireUpdateMode: LiveVisualMode;
  /** `bounded_snapshot.snapshot_origin` when present; otherwise honest placeholder. */
  snapshotOrigin: string;
  /** Client checkbox vs server capability from preflight. */
  deltaWire: { checkbox: boolean; serverSessionDeltaWireV0: boolean | undefined };
  /** Last HTTP reconcile; null means none yet. */
  lastReconcile: HttpReconcileRecord | null;
}

export interface LiveVisualProvenanceInput {
  webGpuProbeStatus: WebGpuLiveStatus;
  /** True when `tryInitWebGpuCanvas` returned a bundle (GPU path may be used). */
  webGpuBundlePresent: boolean;
  lastPaint: PaintLiveVisualSurfaceResult | null;
  visualSpec: Pick<LiveVisualSpec, "mode">;
  lastHttp: BoundedSnapshotF04 | null;
  lastReconcile: HttpReconcileRecord | null;
  deltaWireCheckbox: boolean;
  /** From `GET /capabilities` `websocket.session_delta_wire_v0`; `undefined` if not fetched. */
  sessionDeltaWireV0FromCaps: boolean | undefined;
}

const SNAPSHOT_NONE = "none_yet";

const WIRE_STRIP_LABEL: Record<LiveVisualMode, string> = {
  idle: "idle",
  hello: "hello",
  replace: "replace",
  append: "append",
  none_delta: "none_delta",
  resync: "resync_required",
  warning: "warning",
};

/**
 * Deterministic derivation — no DOM, no I/O.
 */
export function buildLiveVisualProvenanceStrip(input: LiveVisualProvenanceInput): LiveVisualProvenanceStrip {
  const { rendererMode, canvasOnlyGpuSubdetail } = deriveRendererMode(
    input.webGpuProbeStatus,
    input.webGpuBundlePresent,
    input.lastPaint,
  );

  const origin =
    input.lastHttp?.bounded_snapshot?.snapshot_origin !== undefined &&
    input.lastHttp.bounded_snapshot?.snapshot_origin !== null &&
    String(input.lastHttp.bounded_snapshot.snapshot_origin).length > 0
      ? String(input.lastHttp.bounded_snapshot.snapshot_origin)
      : SNAPSHOT_NONE;

  return {
    rendererMode,
    canvasOnlyGpuSubdetail,
    wireUpdateMode: input.visualSpec.mode,
    snapshotOrigin: origin,
    deltaWire: {
      checkbox: input.deltaWireCheckbox,
      serverSessionDeltaWireV0: input.sessionDeltaWireV0FromCaps,
    },
    lastReconcile: input.lastReconcile,
  };
}

export function deriveRendererMode(
  probe: WebGpuLiveStatus,
  bundlePresent: boolean,
  paint: PaintLiveVisualSurfaceResult | null,
): { rendererMode: LiveVisualRendererModeLabel; canvasOnlyGpuSubdetail: CanvasOnlyGpuSubdetail } {
  if (paint?.hybridTextOverlayActive && paint.webGpuActive) {
    return { rendererMode: "hybrid", canvasOnlyGpuSubdetail: "none" };
  }
  if (probe === "unavailable") {
    return { rendererMode: "webgpu_unavailable", canvasOnlyGpuSubdetail: "none" };
  }
  if (probe === "failed_with_fallback") {
    return { rendererMode: "webgpu_failed_with_fallback", canvasOnlyGpuSubdetail: "none" };
  }

  const canvasOnlyGpuSubdetail: CanvasOnlyGpuSubdetail =
    bundlePresent && probe === "initialized" && paint && !paint.hybridTextOverlayActive
      ? "gpu_frame_or_overlay_failed"
      : bundlePresent || probe === "available_but_not_initialized"
        ? "pending_or_no_bundle"
        : "none";

  return { rendererMode: "canvas_only", canvasOnlyGpuSubdetail };
}

function formatDeltaWireLine(d: LiveVisualProvenanceStrip["deltaWire"]): string {
  const chk = d.checkbox ? "on" : "off";
  const srv =
    d.serverSessionDeltaWireV0 === undefined
      ? "unknown"
      : d.serverSessionDeltaWireV0
        ? "true"
        : "false";
  return `delta_wire checkbox=${chk} · server_session_delta_wire_v0=${srv}`;
}

function formatReconcileOneLine(r: HttpReconcileRecord | null): string {
  if (!r) {
    return "reconcile_last=none";
  }
  const bits = [r.status, r.trigger];
  if (r.status === "ok" && r.eventsCount !== undefined) {
    bits.push(`events=${r.eventsCount}`);
  }
  if (r.status === "error" && r.errorMessage) {
    bits.push(`err=${truncate(r.errorMessage, 40)}`);
  }
  return `reconcile_last=${bits.join(" ")}`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) {
    return s;
  }
  return `${s.slice(0, n)}…`;
}

/**
 * Single compact monospace-friendly block (two lines) for the shell.
 */
export function formatLiveVisualProvenanceStripText(strip: LiveVisualProvenanceStrip): string {
  const r = strip.rendererMode;
  const sub =
    strip.rendererMode === "canvas_only" && strip.canvasOnlyGpuSubdetail !== "none"
      ? ` (${strip.canvasOnlyGpuSubdetail})`
      : "";
  const line1 = `renderer=${r}${sub} · wire=${WIRE_STRIP_LABEL[strip.wireUpdateMode]} · snapshot_origin=${strip.snapshotOrigin}`;
  const line2 = `${formatDeltaWireLine(strip.deltaWire)} · ${formatReconcileOneLine(strip.lastReconcile)}`;
  return `${line1}\n${line2}`;
}

/** Honesty line for docs / screen-reader — does not claim full history or topology. */
export const LIVE_VISUAL_PROVENANCE_STRIP_HONESTY =
  "Provenance reflects current bounded session + last HTTP snapshot fields only — not a timeline, not full history, not topology.";

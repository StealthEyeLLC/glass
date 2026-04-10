import { describe, expect, it } from "vitest";
import {
  buildLiveVisualProvenanceStrip,
  deriveRendererMode,
  formatLiveVisualProvenanceStripText,
  LIVE_VISUAL_PROVENANCE_STRIP_HONESTY,
} from "./liveVisualProvenance.js";

const baseInput = {
  webGpuProbeStatus: "initialized" as const,
  webGpuBundlePresent: true,
  lastPaint: {
    fallbackTextShouldHide: true,
    webGpuActive: true,
    hybridTextOverlayActive: true,
  },
  visualSpec: { mode: "append" as const },
  lastHttp: {
    session_id: "s",
    snapshot_cursor: "c",
    events: [],
    bounded_snapshot: {
      snapshot_origin: "collector_store",
      returned_events: 0,
      available_in_view: 0,
      truncated_by_max_events: false,
      cursor_semantics: "opaque",
    },
  },
  lastReconcile: {
    atIso: "2020-01-01T00:00:00.000Z",
    trigger: "operator" as const,
    status: "ok" as const,
    eventsCount: 3,
  },
  deltaWireCheckbox: true,
  sessionDeltaWireV0FromCaps: true,
};

describe("deriveRendererMode", () => {
  it("returns hybrid when paint shows hybrid + WebGPU active", () => {
    expect(
      deriveRendererMode("initialized", true, {
        fallbackTextShouldHide: true,
        webGpuActive: true,
        hybridTextOverlayActive: true,
      }),
    ).toEqual({ rendererMode: "hybrid", canvasOnlyGpuSubdetail: "none" });
  });

  it("returns webgpu_unavailable when probe is unavailable", () => {
    expect(deriveRendererMode("unavailable", false, null)).toEqual({
      rendererMode: "webgpu_unavailable",
      canvasOnlyGpuSubdetail: "none",
    });
  });

  it("returns webgpu_failed_with_fallback when init failed", () => {
    expect(deriveRendererMode("failed_with_fallback", false, null)).toEqual({
      rendererMode: "webgpu_failed_with_fallback",
      canvasOnlyGpuSubdetail: "none",
    });
  });

  it("returns canvas_only with gpu_frame_or_overlay_failed when bundle+initialized but not hybrid", () => {
    expect(
      deriveRendererMode("initialized", true, {
        fallbackTextShouldHide: true,
        webGpuActive: false,
        hybridTextOverlayActive: false,
      }),
    ).toEqual({
      rendererMode: "canvas_only",
      canvasOnlyGpuSubdetail: "gpu_frame_or_overlay_failed",
    });
  });

  it("returns canvas_only with pending when no paint yet but bundle path loading", () => {
    expect(deriveRendererMode("available_but_not_initialized", false, null)).toEqual({
      rendererMode: "canvas_only",
      canvasOnlyGpuSubdetail: "pending_or_no_bundle",
    });
  });
});

describe("buildLiveVisualProvenanceStrip", () => {
  it("maps snapshot_origin and reconcile", () => {
    const s = buildLiveVisualProvenanceStrip(baseInput);
    expect(s.rendererMode).toBe("hybrid");
    expect(s.snapshotOrigin).toBe("collector_store");
    expect(s.lastReconcile?.status).toBe("ok");
    expect(s.deltaWire.checkbox).toBe(true);
    expect(s.deltaWire.serverSessionDeltaWireV0).toBe(true);
  });

  it("uses none_yet when bounded_snapshot origin missing", () => {
    const s = buildLiveVisualProvenanceStrip({
      ...baseInput,
      lastHttp: { session_id: "s", snapshot_cursor: "c", events: [] },
    });
    expect(s.snapshotOrigin).toBe("none_yet");
  });

  it("shows per_rpc_procfs origin when present", () => {
    const s = buildLiveVisualProvenanceStrip({
      ...baseInput,
      lastHttp: {
        session_id: "s",
        snapshot_cursor: "c",
        events: [],
        bounded_snapshot: {
          snapshot_origin: "per_rpc_procfs",
          returned_events: 1,
          available_in_view: 1,
          truncated_by_max_events: false,
          cursor_semantics: "x",
        },
      },
    });
    expect(s.snapshotOrigin).toBe("per_rpc_procfs");
  });

  it("marks delta server unknown when capabilities not fetched", () => {
    const s = buildLiveVisualProvenanceStrip({
      ...baseInput,
      sessionDeltaWireV0FromCaps: undefined,
    });
    expect(s.deltaWire.serverSessionDeltaWireV0).toBeUndefined();
    const t = formatLiveVisualProvenanceStripText(s);
    expect(t).toContain("server_session_delta_wire_v0=unknown");
  });
});

describe("formatLiveVisualProvenanceStripText", () => {
  it("includes renderer and wire labels on line 1", () => {
    const t = formatLiveVisualProvenanceStripText(buildLiveVisualProvenanceStrip(baseInput));
    expect(t).toContain("renderer=hybrid");
    expect(t).toContain("wire=append");
    expect(t).toContain("snapshot_origin=collector_store");
  });

  it("distinguishes hybrid from canvas_only in output", () => {
    const hybrid = formatLiveVisualProvenanceStripText(buildLiveVisualProvenanceStrip(baseInput));
    const canvas = formatLiveVisualProvenanceStripText(
      buildLiveVisualProvenanceStrip({
        ...baseInput,
        lastPaint: {
          fallbackTextShouldHide: true,
          webGpuActive: false,
          hybridTextOverlayActive: false,
        },
      }),
    );
    expect(hybrid).toContain("renderer=hybrid");
    expect(canvas).toContain("renderer=canvas_only");
    expect(canvas).toContain("gpu_frame_or_overlay_failed");
  });

  it("includes reconcile error when present", () => {
    const t = formatLiveVisualProvenanceStripText(
      buildLiveVisualProvenanceStrip({
        ...baseInput,
        lastReconcile: {
          atIso: "x",
          trigger: "session_resync_required",
          status: "error",
          errorMessage: "snapshot HTTP 503",
        },
      }),
    );
    expect(t).toContain("reconcile_last=");
    expect(t).toContain("error");
  });

  it("exports honesty constant for UI copy", () => {
    expect(LIVE_VISUAL_PROVENANCE_STRIP_HONESTY.length).toBeGreaterThan(20);
    expect(LIVE_VISUAL_PROVENANCE_STRIP_HONESTY.toLowerCase()).toContain("not topology");
  });
});

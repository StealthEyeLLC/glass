import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "./applyLiveSessionMessage.js";
import {
  buildLiveStatePresentationDoc,
  liveConnectDisabledFromPreflight,
  serializePresentationDoc,
} from "./liveStatePresentation.js";
import { makeReconcileRecord } from "./liveHttpReconcile.js";
import type { BoundedSnapshotF04 } from "./liveSessionHttp.js";
import type { BridgeCapabilitiesLive } from "./liveCapabilities.js";

function sampleCaps(configured: boolean): BridgeCapabilitiesLive {
  return {
    bridge_api_version: 1,
    collector_fipc: {
      transport: "tcp",
      configured,
      wire_protocol_version: 1,
    },
    websocket: {
      path: "/ws",
      delta_stream_status: "x",
      live_session_delta_skeleton: true,
      session_delta_wire_v0: true,
    },
    live_session_ingest: configured,
    resync: {
      provisional_backlog_event_threshold: 0,
      recovery_strategy: "",
    },
  };
}

describe("buildLiveStatePresentationDoc", () => {
  it("includes resync reason and HTTP reconcile trigger for resync-driven refresh", () => {
    let m = createInitialLiveSessionModelState("sid");
    m = {
      ...m,
      lastResync: {
        msg: "session_resync_required",
        reason: "live_ws_snapshot_poll_failed_v0",
        protocol: 1,
      },
    };
    const rec = makeReconcileRecord("session_resync_required", "ok", {
      eventsCount: 4,
    });
    const doc = buildLiveStatePresentationDoc(m, rec, null);
    expect(doc.lastResyncReason).toContain("poll_failed");
    expect(doc.lastHttpReconcile?.trigger).toBe("session_resync_required");
    expect(doc.lastHttpReconcile?.eventsCount).toBe(4);
    const json = serializePresentationDoc(doc);
    expect(json).toContain("session_resync_required");
  });

  it("uses stronger bounded-sample honesty when truncated", () => {
    const m = createInitialLiveSessionModelState("s");
    const withTrunc = {
      ...m,
      lastReplaced: {
        session_id: "s",
        snapshot_cursor: "c",
        snapshot_origin: "collector_store",
        events_sample: [],
        truncated_by_max_events: true,
      },
    };
    const doc = buildLiveStatePresentationDoc(withTrunc, null, null);
    expect(doc.boundedSampleHonesty).toContain("bounded sample");
  });

  it("falls back HTTP snapshot meta when WS replace not yet seen", () => {
    const m = createInitialLiveSessionModelState("s");
    const http: BoundedSnapshotF04 = {
      session_id: "s",
      snapshot_cursor: "http-cursor",
      events: [],
      bounded_snapshot: {
        snapshot_origin: "per_rpc_procfs",
        returned_events: 0,
        available_in_view: 0,
        truncated_by_max_events: false,
        cursor_semantics: "opaque",
      },
    };
    const doc = buildLiveStatePresentationDoc(m, null, http);
    expect(doc.snapshotMeta?.snapshot_cursor).toBe("http-cursor");
    expect(doc.snapshotMeta?.snapshot_origin).toBe("per_rpc_procfs");
  });
});

describe("liveConnectDisabledFromPreflight", () => {
  it("does not disable when preflight failed or missing", () => {
    expect(liveConnectDisabledFromPreflight("http 401", null).disabled).toBe(false);
    expect(liveConnectDisabledFromPreflight(null, null).disabled).toBe(false);
  });

  it("disables when preflight ok and collector_fipc not configured", () => {
    const r = liveConnectDisabledFromPreflight(null, sampleCaps(false));
    expect(r.disabled).toBe(true);
    expect(r.reason).toContain("collector_fipc");
  });

  it("allows connect when configured", () => {
    const r = liveConnectDisabledFromPreflight(null, sampleCaps(true));
    expect(r.disabled).toBe(false);
  });
});

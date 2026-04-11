import { describe, expect, it } from "vitest";
import {
  buildLiveVisualSpec,
  LIVE_VISUAL_MODE_FILL,
  liveVisualDensity01,
} from "./liveVisualModel.js";
import {
  applyLiveSessionLine,
  createInitialLiveSessionModelState,
} from "./applyLiveSessionMessage.js";
import { makeReconcileRecord } from "./liveHttpReconcile.js";

describe("liveVisualDensity01", () => {
  it("caps at 1", () => {
    expect(liveVisualDensity01(0, 10)).toBe(0);
    expect(liveVisualDensity01(5, 10)).toBe(0.5);
    expect(liveVisualDensity01(100, 10)).toBe(1);
  });
});

describe("LIVE_VISUAL_MODE_FILL", () => {
  it("has distinct colors for append vs replace vs resync vs warning", () => {
    expect(LIVE_VISUAL_MODE_FILL.append).not.toBe(LIVE_VISUAL_MODE_FILL.replace);
    expect(LIVE_VISUAL_MODE_FILL.resync).not.toBe(LIVE_VISUAL_MODE_FILL.warning);
  });
});

describe("buildLiveVisualSpec", () => {
  it("idle with empty model", () => {
    const m = createInitialLiveSessionModelState("s");
    const spec = buildLiveVisualSpec(m, null);
    expect(spec.mode).toBe("idle");
    expect(spec.eventTailCount).toBe(0);
    expect(spec.stripSource).toBe("live");
    expect(spec.replayPrefixFraction).toBeNull();
    expect(spec.actorClusterSummaryLine).toBeNull();
    expect(spec.honestyLine.length).toBeGreaterThan(10);
  });

  it("replace after session_snapshot_replaced", () => {
    let m = createInitialLiveSessionModelState("s1");
    m = applyLiveSessionLine(
      m,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_snapshot_replaced",
        session_id: "s1",
        snapshot_cursor: "c",
        snapshot_origin: "collector_store",
        events_sample: [{ a: 1 }],
      }),
    );
    const spec = buildLiveVisualSpec(m, null);
    expect(spec.mode).toBe("replace");
    expect(spec.eventTailCount).toBe(1);
    expect(spec.snapshotOriginLabel).toBe("collector_store");
  });

  it("append after session_delta with events", () => {
    let m = createInitialLiveSessionModelState("s1");
    m = applyLiveSessionLine(
      m,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_snapshot_replaced",
        session_id: "s1",
        snapshot_cursor: "c",
        snapshot_origin: "collector_store",
        events_sample: [{ a: 1 }],
      }),
    );
    m = applyLiveSessionLine(
      m,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_delta",
        session_id: "s1",
        snapshot_cursor: "c",
        events: [{ b: 2 }],
      }),
    );
    expect(buildLiveVisualSpec(m, null).mode).toBe("append");
  });

  it("resync when last applied is session_resync_required", () => {
    let m = createInitialLiveSessionModelState("s1");
    m = applyLiveSessionLine(
      m,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_resync_required",
        reason: "live_ws_snapshot_poll_failed_v0",
      }),
    );
    const spec = buildLiveVisualSpec(m, null);
    expect(spec.mode).toBe("resync");
    expect(spec.resyncReason).toContain("poll_failed");
  });

  it("warning takes priority over tail mutation", () => {
    let m = createInitialLiveSessionModelState("s1");
    m = applyLiveSessionLine(
      m,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_snapshot_replaced",
        session_id: "s1",
        snapshot_cursor: "c",
        snapshot_origin: "collector_store",
        events_sample: [{}],
      }),
    );
    m = applyLiveSessionLine(
      m,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_warning",
        code: "W1",
        detail: "x",
      }),
    );
    expect(buildLiveVisualSpec(m, null).mode).toBe("warning");
    expect(buildLiveVisualSpec(m, null).warningCode).toBe("W1");
  });

  it("includes reconcile summary when record present", () => {
    const m = createInitialLiveSessionModelState("s");
    const rec = makeReconcileRecord("session_resync_required", "ok", { eventsCount: 3 });
    const spec = buildLiveVisualSpec(m, rec);
    expect(spec.reconcileSummary).toContain("session_resync_required");
    expect(spec.reconcileSummary).toContain("ok");
    expect(spec.reconcileSummary).toContain("3");
  });

  it("uses httpSnapshotOrigin when WS replace not yet applied", () => {
    const m = createInitialLiveSessionModelState("s1");
    const spec = buildLiveVisualSpec(m, null, { httpSnapshotOrigin: "http_body_origin" });
    expect(spec.snapshotOriginLabel).toBe("http_body_origin");
  });

  it("none_delta for empty session_delta", () => {
    let m = createInitialLiveSessionModelState("s1");
    m = applyLiveSessionLine(
      m,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_snapshot_replaced",
        session_id: "s1",
        snapshot_cursor: "c",
        snapshot_origin: "collector_store",
        events_sample: [{}],
      }),
    );
    m = applyLiveSessionLine(
      m,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_delta",
        session_id: "s1",
        snapshot_cursor: "c",
      }),
    );
    expect(buildLiveVisualSpec(m, null).mode).toBe("none_delta");
  });
});

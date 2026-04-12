import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "./applyLiveSessionMessage.js";
import { makeReconcileRecord } from "./liveHttpReconcile.js";
import { liveTrustBandShouldShow } from "./liveTrustGate.js";

describe("liveTrustBandShouldShow", () => {
  it("returns false while HTTP snapshot is in flight", () => {
    let m = createInitialLiveSessionModelState("s");
    m = {
      ...m,
      eventTail: [{ k: 1 }],
    };
    const lastHttp = {
      session_id: "s",
      snapshot_cursor: "c",
      events: [{ x: 1 }],
    };
    const rec = makeReconcileRecord("operator", "ok", { eventsCount: 1 });
    expect(liveTrustBandShouldShow(m, lastHttp, rec, true)).toBe(false);
  });

  it("returns false for hello-only / empty tail with no successful HTTP body", () => {
    const m = {
      ...createInitialLiveSessionModelState("s"),
      lastAppliedWire: {
        msg: "session_hello",
        eventTailMutation: "none",
        appendedEventCount: 0,
        summary: "session_hello",
      },
    };
    expect(liveTrustBandShouldShow(m, null, null, false)).toBe(false);
  });

  it("returns true when bounded WS tail is non-empty", () => {
    let m = createInitialLiveSessionModelState("s");
    m = { ...m, eventTail: [{ kind: "x" }] };
    expect(liveTrustBandShouldShow(m, null, null, false)).toBe(true);
  });

  it("returns true after successful HTTP snapshot with events in body", () => {
    const m = createInitialLiveSessionModelState("s");
    const lastHttp = {
      session_id: "s",
      snapshot_cursor: "c",
      events: [{ e: 1 }],
    };
    const rec = makeReconcileRecord("operator", "ok", { eventsCount: 1 });
    expect(liveTrustBandShouldShow(m, lastHttp, rec, false)).toBe(true);
  });

  it("returns false for HTTP ok reconcile with zero events in body", () => {
    const m = createInitialLiveSessionModelState("s");
    const lastHttp = {
      session_id: "s",
      snapshot_cursor: "c",
      events: [],
    };
    const rec = makeReconcileRecord("operator", "ok", { eventsCount: 0 });
    expect(liveTrustBandShouldShow(m, lastHttp, rec, false)).toBe(false);
  });
});

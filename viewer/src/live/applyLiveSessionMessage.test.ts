import { describe, expect, it } from "vitest";
import {
  applyLiveSessionLine,
  applyLiveSessionRecord,
  createInitialLiveSessionModelState,
  parseLiveSessionWire,
  parseSessionHello,
} from "./applyLiveSessionMessage.js";

describe("applyLiveSessionLine", () => {
  it("handles session_hello", () => {
    let s = createInitialLiveSessionModelState("s1");
    const line = JSON.stringify({
      type: "glass.bridge.live_session.v1",
      msg: "session_hello",
      protocol: 1,
      session_id: "s1",
      continuity_model: "bounded_f_ipc_polling_not_durable",
      session_delta_wire_active: true,
    });
    s = applyLiveSessionLine(s, line);
    expect(s.lastHello?.msg).toBe("session_hello");
    expect(s.lastHello?.session_delta_wire_active).toBe(true);
    expect(s.lastAppliedWire?.msg).toBe("session_hello");
    expect(s.lastAppliedWire?.eventTailMutation).toBe("none");
  });

  it("applies session_snapshot_replaced as bounded replacement (sample list)", () => {
    let s = createInitialLiveSessionModelState("s1");
    const line = JSON.stringify({
      type: "glass.bridge.live_session.v1",
      msg: "session_snapshot_replaced",
      protocol: 1,
      session_id: "s1",
      snapshot_cursor: "v0:off:2",
      snapshot_origin: "collector_store",
      returned_events: 2,
      available_in_view: 2,
      truncated_by_max_events: false,
      events_sample: [{ seq: 1 }, { seq: 2 }],
      events_omitted_from_sample: 0,
    });
    s = applyLiveSessionLine(s, line);
    expect(s.lastReplaced?.snapshot_cursor).toBe("v0:off:2");
    expect(s.lastReplaced?.snapshot_origin).toBe("collector_store");
    expect(s.eventTail).toEqual([{ seq: 1 }, { seq: 2 }]);
    expect(s.lastAppliedWire?.msg).toBe("session_snapshot_replaced");
    expect(s.lastAppliedWire?.eventTailMutation).toBe("replace");
    expect(s.lastAppliedWire?.appendedEventCount).toBe(2);
    expect(s.lastAppliedWire?.summary).toContain("events_sample");
  });

  it("appends non-empty session_delta events only", () => {
    let s = createInitialLiveSessionModelState("s1");
    s = applyLiveSessionLine(
      s,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_snapshot_replaced",
        protocol: 1,
        session_id: "s1",
        snapshot_cursor: "v0:off:1",
        snapshot_origin: "collector_store",
        events_sample: [{ seq: 1 }],
        events_omitted_from_sample: 0,
      }),
    );
    s = applyLiveSessionLine(
      s,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_delta",
        protocol: 1,
        session_id: "s1",
        ws_seq: 0,
        snapshot_cursor: "v0:off:1",
        events: [{ seq: 2 }],
      }),
    );
    expect(s.eventTail).toEqual([{ seq: 1 }, { seq: 2 }]);
    expect(s.lastDeltaWsSeq).toBe(0);
    expect(s.lastAppliedWire?.msg).toBe("session_delta");
    expect(s.lastAppliedWire?.eventTailMutation).toBe("append");
    expect(s.lastAppliedWire?.appendedEventCount).toBe(1);
  });

  it("does not append when session_delta has no events", () => {
    let s = createInitialLiveSessionModelState("s1");
    s = applyLiveSessionLine(
      s,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_snapshot_replaced",
        protocol: 1,
        session_id: "s1",
        snapshot_cursor: "v0:off:1",
        snapshot_origin: "collector_store",
        events_sample: [{ seq: 1 }],
        events_omitted_from_sample: 0,
      }),
    );
    const before = s.eventTail.length;
    s = applyLiveSessionLine(
      s,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_delta",
        protocol: 1,
        session_id: "s1",
        snapshot_cursor: "v0:off:1",
      }),
    );
    expect(s.eventTail.length).toBe(before);
    expect(s.lastAppliedWire?.msg).toBe("session_delta");
    expect(s.lastAppliedWire?.eventTailMutation).toBe("none");
    expect(s.lastAppliedWire?.summary).toContain("no events appended");
  });

  it("session_resync_required increments reconcile counter", () => {
    let s = createInitialLiveSessionModelState("s1");
    s = applyLiveSessionLine(
      s,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_resync_required",
        protocol: 1,
        reason: "live_ws_snapshot_poll_failed_v0",
        action: "use_http_snapshot",
      }),
    );
    expect(s.httpReconcileRequested).toBe(1);
    expect(s.lastResync?.reason).toContain("poll_failed");
    expect(s.lastAppliedWire?.msg).toBe("session_resync_required");
    expect(s.lastAppliedWire?.summary).toContain("session_resync_required");
    expect(s.lastAppliedWire?.summary).toContain("HTTP reconcile");
  });

  it("session_warning", () => {
    let s = createInitialLiveSessionModelState("s1");
    s = applyLiveSessionLine(
      s,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_warning",
        protocol: 1,
        code: "x",
        detail: "y",
      }),
    );
    expect(s.lastWarning?.code).toBe("x");
    expect(s.lastWarning?.detail).toBe("y");
    expect(s.lastAppliedWire?.msg).toBe("session_warning");
  });

  it("session_snapshot_replaced notes bounded sample when truncated", () => {
    let s = createInitialLiveSessionModelState("s1");
    s = applyLiveSessionLine(
      s,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_snapshot_replaced",
        session_id: "s1",
        snapshot_cursor: "c",
        snapshot_origin: "collector_store",
        truncated_by_max_events: true,
        events_sample: [{ a: 1 }],
        events_omitted_from_sample: 3,
      }),
    );
    expect(s.lastAppliedWire?.summary).toContain("bounded sample");
  });

  it("ignores unrelated JSON", () => {
    const s = createInitialLiveSessionModelState("s1");
    const t = applyLiveSessionLine(s, "{}");
    expect(t).toEqual(s);
  });
});

describe("parseLiveSessionWire", () => {
  it("returns object for live_session lines", () => {
    const r = parseLiveSessionWire(
      '{"type":"glass.bridge.live_session.v1","msg":"session_hello","session_id":"a"}',
    );
    expect(r).not.toBeNull();
    if (r) {
      expect(parseSessionHello(r)).not.toBeNull();
    }
  });
});

describe("applyLiveSessionRecord", () => {
  it("double resync increments twice (honest queue simulation)", () => {
    let s = createInitialLiveSessionModelState("s1");
    const r = {
      type: "glass.bridge.live_session.v1",
      msg: "session_resync_required",
      reason: "r",
      protocol: 1,
    };
    s = applyLiveSessionRecord(s, r as Record<string, unknown>);
    s = applyLiveSessionRecord(s, r as Record<string, unknown>);
    expect(s.httpReconcileRequested).toBe(2);
  });
});

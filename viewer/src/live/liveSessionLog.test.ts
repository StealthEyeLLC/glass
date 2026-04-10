import { describe, expect, it } from "vitest";
import {
  appendLiveSessionLogLine,
  createInitialLiveSessionLogState,
  formatLiveSessionLogHuman,
  LIVE_SESSION_LOG_DEFAULT_MAX_LINES,
  serializeLiveSessionLogForExport,
  summarizeLiveWireForLog,
  truncateForLog,
} from "./liveSessionLog.js";

describe("appendLiveSessionLogLine", () => {
  it("appends with ISO timestamp from injected clock", () => {
    let s = createInitialLiveSessionLogState(10);
    s = appendLiveSessionLogLine(
      s,
      { source: "operator", message: "test", meta: { a: 1 } },
      1_700_000_000_000,
    );
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0].atIso).toContain("T");
    expect(s.lines[0].source).toBe("operator");
    expect(s.lines[0].message).toBe("test");
  });

  it("evicts oldest when exceeding maxLines", () => {
    let s = createInitialLiveSessionLogState(3);
    s = appendLiveSessionLogLine(
      s,
      { source: "ws", message: "one" },
      1_000,
    );
    s = appendLiveSessionLogLine(s, { source: "ws", message: "two" }, 2_000);
    s = appendLiveSessionLogLine(s, { source: "ws", message: "three" }, 3_000);
    s = appendLiveSessionLogLine(s, { source: "http", message: "four" }, 4_000);
    expect(s.lines).toHaveLength(3);
    expect(s.lines[0].message).toBe("two");
    expect(s.lines[2].message).toBe("four");
  });
});

describe("formatLiveSessionLogHuman", () => {
  it("prefixes each line with source bracket", () => {
    let s = createInitialLiveSessionLogState(5);
    s = appendLiveSessionLogLine(s, { source: "preflight", message: "ok" }, 0);
    const t = formatLiveSessionLogHuman(s);
    expect(t).toContain("[preflight]");
    expect(t).toContain("ok");
  });
});

describe("serializeLiveSessionLogForExport", () => {
  it("exports stable v0 shape without secrets", () => {
    let s = createInitialLiveSessionLogState(LIVE_SESSION_LOG_DEFAULT_MAX_LINES);
    s = appendLiveSessionLogLine(s, { source: "http", message: "snap ok" }, 0);
    const raw = serializeLiveSessionLogForExport(s);
    const o = JSON.parse(raw) as {
      kind: string;
      lineCount: number;
      lines: Array<{ source: string }>;
    };
    expect(o.kind).toBe("glass_live_session_log_strip_v0");
    expect(o.lineCount).toBe(1);
    expect(o.lines[0].source).toBe("http");
    expect(raw).not.toMatch(/Bearer|bearer|secret/i);
  });
});

describe("summarizeLiveWireForLog", () => {
  it("summarizes known wire messages without embedding events", () => {
    const hello = summarizeLiveWireForLog(
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_hello",
        session_id: "s1",
        session_delta_wire_active: true,
      }),
    );
    expect(hello?.meta.msg).toBe("session_hello");

    const snap = summarizeLiveWireForLog(
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_snapshot_replaced",
        session_id: "s1",
        snapshot_cursor: "c1",
        snapshot_origin: "collector_store",
        events_sample: [{ x: 1 }],
      }),
    );
    expect(snap?.message).toContain("events_sample_len=1");
    expect(snap?.meta.msg).toBe("session_snapshot_replaced");

    const delta = summarizeLiveWireForLog(
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_delta",
        session_id: "s1",
        snapshot_cursor: "c1",
        events: [{ kind: "process_start" }],
        ws_seq: 3,
      }),
    );
    expect(delta?.message).toContain("append");
    expect(JSON.stringify(delta?.meta)).not.toContain("process_start");

    const resync = summarizeLiveWireForLog(
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_resync_required",
        reason: "live_ws_snapshot_poll_failed_v0",
      }),
    );
    expect(resync?.meta.msg).toBe("session_resync_required");
  });
});

describe("truncateForLog", () => {
  it("truncates long strings", () => {
    expect(truncateForLog("abcd", 3)).toMatch(/^abc/);
    expect(truncateForLog("abcd", 3)).toContain("…");
  });
});

import { describe, expect, it } from "vitest";
import {
  decodeEventsSeg,
  encodeEventsSegV1,
  EVENT_SEG_FORMAT_VERSION_U32,
  EVENT_SEG_MAGIC_UTF8,
} from "./eventsSeg.js";
import { CANONICAL_EVENT_SCHEMA_VERSION } from "./types.js";

function minimalEvent(seq: number, sessionId: string, kind = "process_start") {
  return {
    schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
    event_id: `evt_${seq}`,
    session_id: sessionId,
    ts_ns: seq,
    seq,
    kind,
    actor: {
      entity_type: "process",
      entity_id: "proc_1",
      resolution_quality: "direct",
    },
    attrs: {},
    source: {
      adapter: "test",
      quality: "direct",
      time_domain: "session_monotonic",
    },
  };
}

describe("decodeEventsSeg", () => {
  it("roundtrips via encodeEventsSegV1", () => {
    const e1 = minimalEvent(1, "ses_a");
    const e2 = minimalEvent(2, "ses_a");
    const bytes = encodeEventsSegV1([e1, e2]);
    const r = decodeEventsSeg(bytes);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.events).toHaveLength(2);
      expect(r.events[0]?.seq).toBe(1);
      expect(r.events[1]?.seq).toBe(2);
    }
  });

  it("accepts header-only segment (zero events)", () => {
    const enc = new TextEncoder();
    const magic = enc.encode(EVENT_SEG_MAGIC_UTF8);
    const ver = new Uint8Array(4);
    new DataView(ver.buffer).setUint32(0, EVENT_SEG_FORMAT_VERSION_U32, true);
    const bytes = new Uint8Array(12);
    bytes.set(magic, 0);
    bytes.set(ver, 8);
    const r = decodeEventsSeg(bytes);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.events).toHaveLength(0);
    }
  });

  it("rejects truncated header", () => {
    const r = decodeEventsSeg(new Uint8Array(10));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("truncated");
    }
  });

  it("rejects bad magic", () => {
    const bytes = encodeEventsSegV1([minimalEvent(1, "s")]);
    bytes[0] = 0x58;
    const r = decodeEventsSeg(bytes);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("magic");
    }
  });

  it("rejects unsupported format version", () => {
    const bytes = encodeEventsSegV1([minimalEvent(1, "s")]);
    new DataView(bytes.buffer, bytes.byteOffset + 8, 4).setUint32(0, 99, true);
    const r = decodeEventsSeg(bytes);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("format version");
    }
  });

  it("rejects truncated length prefix", () => {
    const enc = new TextEncoder();
    const magic = enc.encode(EVENT_SEG_MAGIC_UTF8);
    const ver = new Uint8Array(4);
    new DataView(ver.buffer).setUint32(0, EVENT_SEG_FORMAT_VERSION_U32, true);
    const bytes = new Uint8Array(12 + 2);
    bytes.set(magic, 0);
    bytes.set(ver, 8);
    const r = decodeEventsSeg(bytes);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("truncated length prefix");
    }
  });

  it("rejects zero-length record", () => {
    const enc = new TextEncoder();
    const magic = enc.encode(EVENT_SEG_MAGIC_UTF8);
    const ver = new Uint8Array(4);
    new DataView(ver.buffer).setUint32(0, EVENT_SEG_FORMAT_VERSION_U32, true);
    const zlen = new Uint8Array(4);
    new DataView(zlen.buffer).setUint32(0, 0, true);
    const bytes = new Uint8Array(12 + 4);
    bytes.set(magic, 0);
    bytes.set(ver, 8);
    bytes.set(zlen, 12);
    const r = decodeEventsSeg(bytes);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("zero-length");
    }
  });

  it("rejects truncated record payload", () => {
    const enc = new TextEncoder();
    const magic = enc.encode(EVENT_SEG_MAGIC_UTF8);
    const ver = new Uint8Array(4);
    new DataView(ver.buffer).setUint32(0, EVENT_SEG_FORMAT_VERSION_U32, true);
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, 100, true);
    const bytes = new Uint8Array(12 + 4 + 5);
    bytes.set(magic, 0);
    bytes.set(ver, 8);
    bytes.set(len, 12);
    const r = decodeEventsSeg(bytes);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("truncated segment record payload");
    }
  });

  it("rejects invalid JSON in record", () => {
    const enc = new TextEncoder();
    const magic = enc.encode(EVENT_SEG_MAGIC_UTF8);
    const ver = new Uint8Array(4);
    new DataView(ver.buffer).setUint32(0, EVENT_SEG_FORMAT_VERSION_U32, true);
    const payload = enc.encode("{not json");
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, payload.length, true);
    const bytes = new Uint8Array(12 + 4 + payload.length);
    bytes.set(magic, 0);
    bytes.set(ver, 8);
    bytes.set(len, 12);
    bytes.set(payload, 16);
    const r = decodeEventsSeg(bytes);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("not valid JSON");
    }
  });

  it("rejects invalid UTF-8 in record payload", () => {
    const enc = new TextEncoder();
    const magic = enc.encode(EVENT_SEG_MAGIC_UTF8);
    const ver = new Uint8Array(4);
    new DataView(ver.buffer).setUint32(0, EVENT_SEG_FORMAT_VERSION_U32, true);
    const payload = new Uint8Array([0xff, 0xfe, 0xfd]);
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, payload.length, true);
    const bytes = new Uint8Array(12 + 4 + payload.length);
    bytes.set(magic, 0);
    bytes.set(ver, 8);
    bytes.set(len, 12);
    bytes.set(payload, 16);
    const r = decodeEventsSeg(bytes);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("UTF-8");
    }
  });
});

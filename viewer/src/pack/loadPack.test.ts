/**
 * Vitest jsdom uses a VM realm where `fflate` `zipSync` may mis-detect `Uint8Array`
 * file payloads (directory vs file). Node env matches real browser `File` behavior for tests.
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { loadGlassPack } from "./loadPack.js";
import { encodeEventsSegV1 } from "./eventsSeg.js";
import {
  CANONICAL_EVENT_SCHEMA_VERSION,
  PACK_FORMAT_SCAFFOLD_SEG_V0,
  PACK_FORMAT_SCAFFOLD_V0,
} from "./types.js";

function minimalEvent(seq: number, sessionId: string, kind: string) {
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

describe("loadGlassPack", () => {
  it("loads valid scaffold pack", () => {
    const sessionId = "ses_ts";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: false,
      human_readable_redaction_summary: [],
      share_safe_recommended: false,
      events_blob: "events.jsonl",
    };
    const e1 = minimalEvent(1, sessionId, "process_start");
    const e2 = minimalEvent(2, sessionId, "process_end");
    const jsonl = `${JSON.stringify(e1)}\n${JSON.stringify(e2)}\n`;
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.jsonl": strToU8(jsonl),
    });
    const r = loadGlassPack(zip, "strict_kinds");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.events).toHaveLength(2);
      expect(r.manifest.session_id).toBe(sessionId);
    }
  });

  it("rejects bad PK header", () => {
    const r = loadGlassPack(new Uint8Array([1, 2, 3, 4]));
    expect(r.ok).toBe(false);
  });

  it("accepts sanitized replay manifest (Tier B static replay)", () => {
    const sessionId = "ses_ui";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: true,
      human_readable_redaction_summary: ["rule:x"],
      share_safe_recommended: false,
      events_blob: "events.jsonl",
    };
    const ev = {
      schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
      event_id: "evt_1",
      session_id: sessionId,
      ts_ns: 1,
      seq: 1,
      kind: "process_start",
      actor: {
        entity_type: "process",
        entity_id: "p1",
        resolution_quality: "direct",
      },
      attrs: {},
      source: { adapter: "t", quality: "direct", time_domain: "session_monotonic" },
    };
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.jsonl": strToU8(`${JSON.stringify(ev)}\n`),
    });
    const r = loadGlassPack(zip, "basic");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest.sanitized).toBe(true);
      expect(r.events).toHaveLength(1);
    }
  });

  it("accepts empty events.jsonl (no event lines)", () => {
    const sessionId = "ses_empty";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: false,
      human_readable_redaction_summary: [],
      share_safe_recommended: false,
    };
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.jsonl": strToU8("\n\n"),
    });
    const r = loadGlassPack(zip, "basic");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.events).toHaveLength(0);
    }
  });

  it("rejects invalid manifest.json JSON", () => {
    const zip = zipSync({
      "manifest.json": strToU8("{not json"),
      "events.jsonl": strToU8(""),
    });
    const r = loadGlassPack(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("manifest");
    }
  });

  it("rejects invalid JSONL line", () => {
    const sessionId = "ses_badline";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: false,
      human_readable_redaction_summary: [],
      share_safe_recommended: false,
    };
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.jsonl": strToU8("{broken\n"),
    });
    const r = loadGlassPack(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("jsonl");
    }
  });

  it("rejects wrong pack_format_version", () => {
    const sessionId = "ses_fmt";
    const manifest = {
      pack_format_version: "glass.pack.future",
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: false,
      human_readable_redaction_summary: [],
      share_safe_recommended: false,
    };
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.jsonl": strToU8(""),
    });
    const r = loadGlassPack(zip);
    expect(r.ok).toBe(false);
  });

  it("strict mode rejects unknown kind", () => {
    const sessionId = "ses_x";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: false,
      human_readable_redaction_summary: [],
      share_safe_recommended: false,
    };
    const e1 = minimalEvent(1, sessionId, "not_a_kind");
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.jsonl": strToU8(`${JSON.stringify(e1)}\n`),
    });
    const strict = loadGlassPack(zip, "strict_kinds");
    expect(strict.ok).toBe(false);
    const basic = loadGlassPack(zip, "basic");
    expect(basic.ok).toBe(true);
  });

  it("loads valid scaffold_seg pack with events.seg", () => {
    const sessionId = "ses_seg";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_SEG_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: false,
      human_readable_redaction_summary: [],
      share_safe_recommended: false,
      events_blob: "events.seg",
    };
    const e1 = minimalEvent(1, sessionId, "process_start");
    const e2 = minimalEvent(2, sessionId, "process_end");
    const seg = encodeEventsSegV1([e1, e2]);
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.seg": seg,
    });
    const r = loadGlassPack(zip, "strict_kinds");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.events).toHaveLength(2);
      expect(r.manifest.pack_format_version).toBe(PACK_FORMAT_SCAFFOLD_SEG_V0);
    }
  });

  it("strict_kinds rejects unknown kind on seg-backed pack", () => {
    const sessionId = "ses_seg_k";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_SEG_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: false,
      human_readable_redaction_summary: [],
      share_safe_recommended: false,
      events_blob: "events.seg",
    };
    const e1 = minimalEvent(1, sessionId, "not_a_kind");
    const seg = encodeEventsSegV1([e1]);
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.seg": seg,
    });
    expect(loadGlassPack(zip, "strict_kinds").ok).toBe(false);
    expect(loadGlassPack(zip, "basic").ok).toBe(true);
  });

  it("accepts empty scaffold_seg (header-only events.seg)", () => {
    const sessionId = "ses_seg_empty";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_SEG_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: false,
      human_readable_redaction_summary: [],
      share_safe_recommended: false,
      events_blob: "events.seg",
    };
    const enc = new TextEncoder();
    const headerOnly = new Uint8Array(12);
    headerOnly.set(enc.encode("GLSSG001"), 0);
    new DataView(headerOnly.buffer).setUint32(8, 1, true);
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.seg": headerOnly,
    });
    const r = loadGlassPack(zip, "basic");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.events).toHaveLength(0);
    }
  });

  it("accepts sanitized scaffold_seg pack", () => {
    const sessionId = "ses_seg_san";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_SEG_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: true,
      human_readable_redaction_summary: ["rule:x"],
      share_safe_recommended: false,
      events_blob: "events.seg",
    };
    const ev = minimalEvent(1, sessionId, "process_start");
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.seg": encodeEventsSegV1([ev]),
    });
    const r = loadGlassPack(zip, "basic");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifest.sanitized).toBe(true);
    }
  });

  it("rejects scaffold pack that contains events.seg", () => {
    const sessionId = "ses_mix";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: false,
      human_readable_redaction_summary: [],
      share_safe_recommended: false,
    };
    const e1 = minimalEvent(1, sessionId, "process_start");
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.jsonl": strToU8(`${JSON.stringify(e1)}\n`),
      "events.seg": encodeEventsSegV1([e1]),
    });
    const r = loadGlassPack(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("must not contain events.seg");
    }
  });

  it("rejects scaffold_seg pack that contains events.jsonl", () => {
    const sessionId = "ses_mix2";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_SEG_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: false,
      human_readable_redaction_summary: [],
      share_safe_recommended: false,
      events_blob: "events.seg",
    };
    const e1 = minimalEvent(1, sessionId, "process_start");
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.jsonl": strToU8(`${JSON.stringify(e1)}\n`),
      "events.seg": encodeEventsSegV1([e1]),
    });
    const r = loadGlassPack(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("must not contain events.jsonl");
    }
  });

  it("rejects scaffold_seg when manifest.events_blob is wrong", () => {
    const sessionId = "ses_blob";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_SEG_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: false,
      human_readable_redaction_summary: [],
      share_safe_recommended: false,
      events_blob: "events.jsonl",
    };
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.seg": encodeEventsSegV1([minimalEvent(1, sessionId)]),
    });
    const r = loadGlassPack(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("events.seg");
    }
  });

  it("rejects malformed events.seg inside zip", () => {
    const sessionId = "ses_badseg";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_SEG_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: false,
      human_readable_redaction_summary: [],
      share_safe_recommended: false,
      events_blob: "events.seg",
    };
    const zip = zipSync({
      "manifest.json": strToU8(JSON.stringify(manifest)),
      "events.seg": new Uint8Array([1, 2, 3]),
    });
    const r = loadGlassPack(zip);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toMatch(/events\.seg|truncated|magic/i);
    }
  });
});

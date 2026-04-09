/**
 * Vitest jsdom uses a VM realm where `fflate` `zipSync` may mis-detect `Uint8Array`
 * file payloads (directory vs file). Node env matches real browser `File` behavior for tests.
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { loadGlassPack } from "./loadPack.js";
import {
  CANONICAL_EVENT_SCHEMA_VERSION,
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
});

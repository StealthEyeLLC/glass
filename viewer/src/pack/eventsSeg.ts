/**
 * Read-only decode of `events.seg` v1 — mirrors `session_engine::events_seg`.
 * Magic `GLSSG001` + u32 LE format version 1 + repeated u32 LE length + UTF-8 JSON per record.
 */
import type { GlassEvent } from "./types.js";
import { PROVISIONAL_MAX_JSONL_LINE_BYTES } from "./types.js";

/** 8-byte ASCII magic (must match `session_engine::EVENT_SEG_MAGIC`). */
export const EVENT_SEG_MAGIC_UTF8 = "GLSSG001";

export const EVENT_SEG_FORMAT_VERSION_U32 = 1;

export type DecodeSegResult =
  | { ok: true; events: GlassEvent[] }
  | { ok: false; error: string };

export function decodeEventsSeg(bytes: Uint8Array): DecodeSegResult {
  if (bytes.length < 12) {
    return { ok: false, error: "events.seg truncated (header)" };
  }
  const head = new TextDecoder("utf-8", { fatal: false }).decode(
    bytes.subarray(0, 8),
  );
  if (head !== EVENT_SEG_MAGIC_UTF8) {
    return { ok: false, error: "bad events.seg magic (expected GLSSG001)" };
  }
  const ver = new DataView(
    bytes.buffer,
    bytes.byteOffset + 8,
    4,
  ).getUint32(0, true);
  if (ver !== EVENT_SEG_FORMAT_VERSION_U32) {
    return {
      ok: false,
      error: `unsupported events.seg format version: ${ver} (expected ${EVENT_SEG_FORMAT_VERSION_U32})`,
    };
  }
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;
  const events: GlassEvent[] = [];
  const utf8 = new TextDecoder("utf-8", { fatal: true });
  while (offset < bytes.length) {
    if (offset + 4 > bytes.length) {
      return { ok: false, error: "truncated length prefix" };
    }
    const len = dv.getUint32(offset, true);
    offset += 4;
    if (len === 0) {
      return { ok: false, error: "zero-length segment record" };
    }
    if (len > PROVISIONAL_MAX_JSONL_LINE_BYTES) {
      return { ok: false, error: "segment record length exceeds maximum (F-07)" };
    }
    if (offset + len > bytes.length) {
      return { ok: false, error: "truncated segment record payload" };
    }
    const payload = bytes.subarray(offset, offset + len);
    let text: string;
    try {
      text = utf8.decode(payload);
    } catch {
      return { ok: false, error: "events.seg record is not valid UTF-8" };
    }
    let ev: GlassEvent;
    try {
      ev = JSON.parse(text) as GlassEvent;
    } catch {
      return { ok: false, error: "events.seg record is not valid JSON" };
    }
    events.push(ev);
    offset += len;
  }
  return { ok: true, events };
}

/**
 * Encode v1 segment bytes (tests / fixtures). Production writers live in Rust (`session_engine`).
 */
export function encodeEventsSegV1(events: GlassEvent[]): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  chunks.push(enc.encode(EVENT_SEG_MAGIC_UTF8));
  const ver = new Uint8Array(4);
  new DataView(ver.buffer).setUint32(0, EVENT_SEG_FORMAT_VERSION_U32, true);
  chunks.push(ver);
  for (const ev of events) {
    const payload = enc.encode(JSON.stringify(ev));
    if (payload.length === 0) {
      throw new Error("encodeEventsSegV1: empty JSON record");
    }
    if (payload.length > PROVISIONAL_MAX_JSONL_LINE_BYTES) {
      throw new Error("encodeEventsSegV1: record exceeds F-07 maximum");
    }
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, payload.length, true);
    chunks.push(len);
    chunks.push(payload);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

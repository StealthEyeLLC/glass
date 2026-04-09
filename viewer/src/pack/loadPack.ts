/**
 * Parse `.glass_pack` (ZIP) in the browser — **read-only**, no upload.
 * Validation rules aligned with `session_engine::validate` + `session_engine::pack`.
 */
import { strFromU8, unzipSync } from "fflate";
import {
  CANONICAL_EVENT_SCHEMA_VERSION,
  KNOWN_EVENT_KINDS_V0,
  PACK_FORMAT_SCAFFOLD_V0,
  PROVISIONAL_MAX_JSONL_LINE_BYTES,
  type GlassEvent,
  type GlassManifest,
  type LoadPackResult,
  type PackValidationLevel,
} from "./types.js";

const MANIFEST_PATH = "manifest.json";
const EVENTS_PATH = "events.jsonl";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateNormalizedEvent(ev: GlassEvent): string | null {
  if (ev.schema_version !== CANONICAL_EVENT_SCHEMA_VERSION) {
    return "event.schema_version must be glass.event.v0";
  }
  if (!ev.event_id || !ev.session_id || !ev.kind) {
    return "event.event_id, session_id, kind required";
  }
  if (ev.seq < 1 || !Number.isInteger(ev.seq)) {
    return "event.seq must be integer >= 1";
  }
  if (!ev.actor?.entity_type || !ev.actor?.entity_id) {
    return "event.actor identity required";
  }
  if (!isRecord(ev.attrs)) {
    return "event.attrs must be object";
  }
  if (!isRecord(ev.source)) {
    return "event.source must be object";
  }
  return null;
}

function validateScaffoldManifest(m: GlassManifest): string | null {
  if (m.pack_format_version !== PACK_FORMAT_SCAFFOLD_V0) {
    return "manifest.pack_format_version must be glass.pack.v0.scaffold";
  }
  if (!m.session_id || !m.capture_mode) {
    return "manifest.session_id and capture_mode required";
  }
  if (m.events_blob !== undefined && m.events_blob !== "events.jsonl") {
    return 'manifest.events_blob must be absent or "events.jsonl"';
  }
  return null;
}

function validatePackEvents(
  m: GlassManifest,
  events: GlassEvent[],
  level: PackValidationLevel,
): string | null {
  const me = validateScaffoldManifest(m);
  if (me) {
    return me;
  }
  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (!ev) {
      return "internal: missing event index";
    }
    const e = validateNormalizedEvent(ev);
    if (e) {
      return e;
    }
    if (ev.session_id !== m.session_id) {
      return "event.session_id must match manifest.session_id";
    }
    const want = i + 1;
    if (ev.seq !== want) {
      return "event.seq must be 1-based consecutive matching line order";
    }
    if (level === "strict_kinds" && !KNOWN_EVENT_KINDS_V0.has(ev.kind)) {
      return "event.kind not in v0 known set (spec §12.5)";
    }
  }
  return null;
}

/**
 * Load and validate pack bytes. `level` mirrors Rust `PackValidationLevel`.
 */
export function loadGlassPack(
  bytes: Uint8Array,
  level: PackValidationLevel = "basic",
): LoadPackResult {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    return { ok: false, error: "not a ZIP (missing PK header)" };
  }
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    return { ok: false, error: "invalid ZIP" };
  }
  const manB = files[MANIFEST_PATH];
  const evB = files[EVENTS_PATH];
  if (!manB) {
    return { ok: false, error: "missing manifest.json" };
  }
  if (!evB) {
    return { ok: false, error: "missing events.jsonl" };
  }
  let manifest: GlassManifest;
  try {
    manifest = JSON.parse(strFromU8(manB)) as GlassManifest;
  } catch {
    return { ok: false, error: "manifest.json is not valid JSON" };
  }
  const lines = strFromU8(evB).split(/\r?\n/);
  const events: GlassEvent[] = [];
  for (const line of lines) {
    const t = line.trimEnd();
    if (t.length === 0) {
      continue;
    }
    if (t.length > PROVISIONAL_MAX_JSONL_LINE_BYTES) {
      return { ok: false, error: "jsonl line exceeds maximum length" };
    }
    try {
      events.push(JSON.parse(t) as GlassEvent);
    } catch {
      return { ok: false, error: "events.jsonl line is not valid JSON" };
    }
  }
  const verr = validatePackEvents(manifest, events, level);
  if (verr) {
    return { ok: false, error: verr };
  }
  return { ok: true, manifest, events };
}

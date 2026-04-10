/**
 * Mirrors `session_engine` JSON shapes for Tier B static replay (`glass.pack.v0.scaffold` / `glass.pack.v0.scaffold_seg`).
 * Codegen from `schema/` is future work — keep in sync manually until then.
 */

export const CANONICAL_EVENT_SCHEMA_VERSION = "glass.event.v0";
export const PACK_FORMAT_SCAFFOLD_V0 = "glass.pack.v0.scaffold";
export const PACK_FORMAT_SCAFFOLD_SEG_V0 = "glass.pack.v0.scaffold_seg";

/** Same as `session_engine::validate::PROVISIONAL_MAX_JSONL_LINE_BYTES` — see PHASE0_FREEZE_TRACKER F-07. */
export const PROVISIONAL_MAX_JSONL_LINE_BYTES = 4 * 1024 * 1024;

/** Spec §12.5 — must match `session_engine::validate::KNOWN_EVENT_KINDS_V0`. */
export const KNOWN_EVENT_KINDS_V0 = new Set<string>([
  "process_start",
  "process_end",
  "process_spawn",
  "file_read",
  "file_write",
  "file_create",
  "file_delete",
  "file_rename",
  "network_connect_attempt",
  "network_connect_result",
  "ipc_connect",
  "ipc_transfer",
  "boundary_cross",
  "resource_heartbeat",
  "file_write_burst",
  "network_burst",
  "ipc_burst",
  "command_exec",
  "env_access",
  "process_poll_sample",
  "process_seen_in_poll_gap",
  "process_absent_in_poll_gap",
]);

export interface EntityRef {
  entity_type: string;
  entity_id: string;
  resolution_quality?: string;
}

export interface GlassEvent {
  schema_version: string;
  event_id: string;
  session_id: string;
  ts_ns: number;
  seq: number;
  kind: string;
  actor: EntityRef;
  subject?: EntityRef;
  parent?: EntityRef;
  attrs: Record<string, unknown>;
  source: Record<string, unknown>;
}

export interface GlassManifest {
  pack_format_version: string;
  session_id: string;
  capture_mode: string;
  fidelity_tier?: string;
  active_adapter_id?: string;
  export_sanitization_profile?: string;
  sanitized: boolean;
  sanitization_profile_version?: string;
  human_readable_redaction_summary: string[];
  share_safe_recommended: boolean;
  events_blob?: string;
}

export type PackValidationLevel = "basic" | "strict_kinds";

export type LoadPackResult =
  | { ok: true; manifest: GlassManifest; events: GlassEvent[] }
  | { ok: false; error: string };

/**
 * Bounded in-memory live session log for `?live=1` operator UI — not a durable audit trail.
 */

import {
  parseLiveSessionWire,
  parseSessionDelta,
  parseSessionHello,
  parseSessionResyncRequired,
  parseSessionSnapshotReplaced,
  parseSessionWarning,
} from "./applyLiveSessionMessage.js";

export const LIVE_SESSION_LOG_DEFAULT_MAX_LINES = 80;

export type LiveSessionLogSource = "operator" | "preflight" | "ws" | "http";

export interface LiveSessionLogLine {
  /** ISO-8601 from clock */
  atIso: string;
  source: LiveSessionLogSource;
  /** Single-line concise summary — no secrets, no large payloads */
  message: string;
  /** Small structured fields for Copy JSON (optional) */
  meta?: Record<string, unknown>;
}

export interface LiveSessionLogState {
  maxLines: number;
  lines: LiveSessionLogLine[];
}

export function createInitialLiveSessionLogState(maxLines: number): LiveSessionLogState {
  return { maxLines: Math.max(1, maxLines), lines: [] };
}

export function truncateForLog(s: string, maxChars: number): string {
  if (s.length <= maxChars) {
    return s;
  }
  return `${s.slice(0, maxChars)}…`;
}

/**
 * Append one line; evicts oldest when over capacity (pure — returns new state).
 */
export function appendLiveSessionLogLine(
  state: LiveSessionLogState,
  entry: Omit<LiveSessionLogLine, "atIso">,
  nowMs: number,
): LiveSessionLogState {
  const atIso = new Date(nowMs).toISOString();
  const nextLines = [...state.lines, { ...entry, atIso }];
  while (nextLines.length > state.maxLines) {
    nextLines.shift();
  }
  return { maxLines: state.maxLines, lines: nextLines };
}

export function formatLiveSessionLogHuman(state: LiveSessionLogState): string {
  return state.lines
    .map((l) => `${l.atIso} [${l.source}] ${l.message}`)
    .join("\n");
}

export function serializeLiveSessionLogForExport(state: LiveSessionLogState): string {
  return JSON.stringify(
    {
      kind: "glass_live_session_log_strip_v0",
      note: "Bounded in-memory viewer log — not authoritative session history; tokens not exported",
      maxLines: state.maxLines,
      lineCount: state.lines.length,
      lines: state.lines,
    },
    null,
    2,
  );
}

/** One-line summary for an inbound live_session WS text line (no event payloads). */
export function summarizeLiveWireForLog(text: string): {
  message: string;
  meta: Record<string, unknown>;
} | null {
  const r = parseLiveSessionWire(text);
  if (!r) {
    return null;
  }
  const rawMsg = typeof r.msg === "string" ? r.msg : "unknown";
  const hello = parseSessionHello(r);
  if (hello) {
    return {
      message: `session_hello session_id=${truncateForLog(hello.session_id, 64)}`,
      meta: {
        msg: "session_hello",
        session_id: hello.session_id,
        session_delta_wire_active: hello.session_delta_wire_active ?? null,
      },
    };
  }
  const snap = parseSessionSnapshotReplaced(r);
  if (snap) {
    const n = snap.events_sample?.length ?? 0;
    return {
      message: `session_snapshot_replaced origin=${snap.snapshot_origin} events_sample_len=${n}`,
      meta: {
        msg: "session_snapshot_replaced",
        snapshot_cursor: snap.snapshot_cursor,
        snapshot_origin: snap.snapshot_origin,
        events_sample_len: n,
        truncated_by_max_events: snap.truncated_by_max_events ?? null,
      },
    };
  }
  const delta = parseSessionDelta(r);
  if (delta) {
    const n = delta.events?.length ?? 0;
    return {
      message:
        n > 0
          ? `session_delta append events_len=${n} ws_seq=${delta.ws_seq ?? "null"}`
          : "session_delta (no events appended)",
      meta: {
        msg: "session_delta",
        events_len: n,
        ws_seq: delta.ws_seq ?? null,
        snapshot_cursor: delta.snapshot_cursor,
      },
    };
  }
  const resync = parseSessionResyncRequired(r);
  if (resync) {
    return {
      message: `session_resync_required reason=${truncateForLog(resync.reason, 120)}`,
      meta: {
        msg: "session_resync_required",
        reason: resync.reason,
        action: resync.action ?? null,
      },
    };
  }
  const warn = parseSessionWarning(r);
  if (warn) {
    return {
      message: `session_warning code=${warn.code} detail=${truncateForLog(warn.detail, 120)}`,
      meta: {
        msg: "session_warning",
        code: warn.code,
        detail: truncateForLog(warn.detail, 200),
      },
    };
  }
  return {
    message: `live_session wire msg=${rawMsg}`,
    meta: { msg: rawMsg },
  };
}

/**
 * Pure application of live-session WebSocket JSON lines onto viewer state.
 * Tests cover behavior; UI uses the same functions.
 */

import type {
  SessionDeltaWire,
  SessionHelloWire,
  SessionResyncRequiredWire,
  SessionSnapshotReplacedWire,
  SessionWarningWire,
} from "./liveSessionTypes.js";

/** How the bounded WS `eventTail` last changed (HTTP snapshot is separate). */
export type EventTailMutation = "none" | "replace" | "append";

/** Last recognized live_session wire message applied to model (for operator UI). */
export interface LastAppliedWireSurface {
  msg: string;
  eventTailMutation: EventTailMutation;
  appendedEventCount: number;
  /** Short honest description — not a continuity guarantee */
  summary: string;
}

export interface LiveSessionModelState {
  sessionId: string;
  lastHello: SessionHelloWire | null;
  /** Latest bounded snapshot metadata from `session_snapshot_replaced` */
  lastReplaced: Omit<SessionSnapshotReplacedWire, "msg"> | null;
  /** Debug tail: replacement uses `events_sample`; deltas append when `events` non-empty */
  eventTail: unknown[];
  lastDeltaWsSeq: number | null;
  lastResync: SessionResyncRequiredWire | null;
  lastWarning: SessionWarningWire | null;
  /** Count of HTTP snapshot reconciliations triggered by resync handling */
  httpReconcileRequested: number;
  /** Last applied wire message (ignored lines leave this unchanged) */
  lastAppliedWire: LastAppliedWireSurface | null;
}

export function createInitialLiveSessionModelState(
  sessionId: string,
): LiveSessionModelState {
  return {
    sessionId,
    lastHello: null,
    lastReplaced: null,
    eventTail: [],
    lastDeltaWsSeq: null,
    lastResync: null,
    lastWarning: null,
    httpReconcileRequested: 0,
    lastAppliedWire: null,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function getString(r: Record<string, unknown>, k: string): string | undefined {
  const x = r[k];
  return typeof x === "string" ? x : undefined;
}

function getNum(r: Record<string, unknown>, k: string): number | undefined {
  const x = r[k];
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}

/** Parse a single WebSocket text line. Returns `null` if not a live_session v1 object. */
export function parseLiveSessionWire(
  text: string,
): Record<string, unknown> | null {
  let v: unknown;
  try {
    v = JSON.parse(text) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(v)) {
    return null;
  }
  if (v.type !== "glass.bridge.live_session.v1") {
    return null;
  }
  return v;
}

export function parseSessionHello(r: Record<string, unknown>): SessionHelloWire | null {
  if (r.msg !== "session_hello") {
    return null;
  }
  const session_id = getString(r, "session_id");
  if (!session_id) {
    return null;
  }
  return {
    msg: "session_hello",
    session_id,
    protocol: getNum(r, "protocol"),
    continuity_model: getString(r, "continuity_model"),
    session_delta_wire_active:
      typeof r.session_delta_wire_active === "boolean"
        ? r.session_delta_wire_active
        : undefined,
    honesty: getString(r, "honesty"),
  };
}

export function parseSessionSnapshotReplaced(
  r: Record<string, unknown>,
): SessionSnapshotReplacedWire | null {
  if (r.msg !== "session_snapshot_replaced") {
    return null;
  }
  const session_id = getString(r, "session_id");
  const snapshot_cursor = getString(r, "snapshot_cursor");
  const snapshot_origin = getString(r, "snapshot_origin");
  if (!session_id || snapshot_cursor === undefined || snapshot_origin === undefined) {
    return null;
  }
  const events_sample = Array.isArray(r.events_sample) ? r.events_sample : [];
  return {
    msg: "session_snapshot_replaced",
    session_id,
    snapshot_cursor,
    snapshot_origin,
    returned_events: getNum(r, "returned_events"),
    available_in_view: getNum(r, "available_in_view"),
    truncated_by_max_events:
      typeof r.truncated_by_max_events === "boolean"
        ? r.truncated_by_max_events
        : undefined,
    retained_snapshot_unix_ms:
      r.retained_snapshot_unix_ms === null ||
      typeof r.retained_snapshot_unix_ms === "number"
        ? (r.retained_snapshot_unix_ms as number | null)
        : undefined,
    continuity: getString(r, "continuity"),
    honesty: getString(r, "honesty"),
    events_sample,
    events_omitted_from_sample: getNum(r, "events_omitted_from_sample"),
  };
}

export function parseSessionDelta(
  r: Record<string, unknown>,
): SessionDeltaWire | null {
  if (r.msg !== "session_delta") {
    return null;
  }
  const session_id = getString(r, "session_id");
  const snapshot_cursor = getString(r, "snapshot_cursor");
  if (!session_id || snapshot_cursor === undefined) {
    return null;
  }
  const events = Array.isArray(r.events) ? r.events : undefined;
  return {
    msg: "session_delta",
    session_id,
    protocol: getNum(r, "protocol"),
    ws_seq: getNum(r, "ws_seq"),
    snapshot_cursor,
    continuity: getString(r, "continuity"),
    events,
    honesty: getString(r, "honesty"),
  };
}

export function parseSessionResyncRequired(
  r: Record<string, unknown>,
): SessionResyncRequiredWire | null {
  if (r.msg !== "session_resync_required") {
    return null;
  }
  const reason = getString(r, "reason");
  if (!reason) {
    return null;
  }
  return {
    msg: "session_resync_required",
    protocol: getNum(r, "protocol"),
    reason,
    action: getString(r, "action"),
    honesty: getString(r, "honesty"),
  };
}

export function parseSessionWarning(
  r: Record<string, unknown>,
): SessionWarningWire | null {
  if (r.msg !== "session_warning") {
    return null;
  }
  const code = getString(r, "code");
  const detail = getString(r, "detail");
  if (!code || detail === undefined) {
    return null;
  }
  return {
    msg: "session_warning",
    protocol: getNum(r, "protocol"),
    code,
    detail,
  };
}

/**
 * Apply one parsed `glass.bridge.live_session.v1` object. Unknown `msg` values are ignored.
 * `session_resync_required` increments `httpReconcileRequested` — the shell should call HTTP snapshot.
 */
export function applyLiveSessionRecord(
  state: LiveSessionModelState,
  r: Record<string, unknown>,
): LiveSessionModelState {
  const hello = parseSessionHello(r);
  if (hello) {
    return {
      ...state,
      lastHello: hello,
      lastAppliedWire: {
        msg: "session_hello",
        eventTailMutation: "none",
        appendedEventCount: 0,
        summary: "session_hello — bounded event tail unchanged",
      },
    };
  }

  const replaced = parseSessionSnapshotReplaced(r);
  if (replaced) {
    const sample = replaced.events_sample ?? [];
    const truncated = replaced.truncated_by_max_events === true;
    const omitted = replaced.events_omitted_from_sample;
    const sampleNote =
      truncated || (typeof omitted === "number" && omitted > 0)
        ? " (bounded sample; not full history)"
        : "";
    return {
      ...state,
      lastReplaced: {
        session_id: replaced.session_id,
        snapshot_cursor: replaced.snapshot_cursor,
        snapshot_origin: replaced.snapshot_origin,
        returned_events: replaced.returned_events,
        available_in_view: replaced.available_in_view,
        truncated_by_max_events: replaced.truncated_by_max_events,
        retained_snapshot_unix_ms: replaced.retained_snapshot_unix_ms,
        continuity: replaced.continuity,
        honesty: replaced.honesty,
        events_sample: replaced.events_sample,
        events_omitted_from_sample: replaced.events_omitted_from_sample,
      },
      eventTail: [...sample],
      lastAppliedWire: {
        msg: "session_snapshot_replaced",
        eventTailMutation: "replace",
        appendedEventCount: sample.length,
        summary: `session_snapshot_replaced — bounded view replaced from events_sample${sampleNote}`,
      },
    };
  }

  const delta = parseSessionDelta(r);
  if (delta) {
    const ev = delta.events;
    const lastDeltaWsSeq =
      delta.ws_seq !== undefined ? delta.ws_seq : state.lastDeltaWsSeq;
    if (ev !== undefined && ev.length > 0) {
      return {
        ...state,
        lastDeltaWsSeq,
        eventTail: [...state.eventTail, ...ev],
        lastAppliedWire: {
          msg: "session_delta",
          eventTailMutation: "append",
          appendedEventCount: ev.length,
          summary: `session_delta — appended ${ev.length} event(s) to bounded tail`,
        },
      };
    }
    return {
      ...state,
      lastDeltaWsSeq,
      lastAppliedWire: {
        msg: "session_delta",
        eventTailMutation: "none",
        appendedEventCount: 0,
        summary:
          "session_delta — no events appended (empty or omitted events array)",
      },
    };
  }

  const resync = parseSessionResyncRequired(r);
  if (resync) {
    return {
      ...state,
      lastResync: resync,
      httpReconcileRequested: state.httpReconcileRequested + 1,
      lastAppliedWire: {
        msg: "session_resync_required",
        eventTailMutation: "none",
        appendedEventCount: 0,
        summary: `session_resync_required — reason ${resync.reason} (viewer should HTTP reconcile)`,
      },
    };
  }

  const warn = parseSessionWarning(r);
  if (warn) {
    return {
      ...state,
      lastWarning: warn,
      lastAppliedWire: {
        msg: "session_warning",
        eventTailMutation: "none",
        appendedEventCount: 0,
        summary: `session_warning — ${warn.code}: ${warn.detail}`,
      },
    };
  }

  return state;
}

export function applyLiveSessionLine(
  state: LiveSessionModelState,
  text: string,
): LiveSessionModelState {
  const r = parseLiveSessionWire(text);
  if (!r) {
    return state;
  }
  return applyLiveSessionRecord(state, r);
}

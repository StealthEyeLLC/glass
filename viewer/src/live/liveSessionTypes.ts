/**
 * Viewer-side shapes for `glass.bridge.live_session.v1` wire JSON (see bridge `live_session_ws`).
 * Not a frozen contract — follow server fields only.
 */

export type LiveConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface SessionHelloWire {
  msg: "session_hello";
  session_id: string;
  protocol?: number;
  continuity_model?: string;
  session_delta_wire_active?: boolean;
  honesty?: string;
}

export interface SessionSnapshotReplacedWire {
  msg: "session_snapshot_replaced";
  session_id: string;
  snapshot_cursor: string;
  snapshot_origin: string;
  returned_events?: number;
  available_in_view?: number;
  truncated_by_max_events?: boolean;
  retained_snapshot_unix_ms?: number | null;
  continuity?: string;
  honesty?: string;
  events_sample?: unknown[];
  events_omitted_from_sample?: number;
}

export interface SessionDeltaWire {
  msg: "session_delta";
  session_id: string;
  protocol?: number;
  ws_seq?: number;
  snapshot_cursor: string;
  continuity?: string;
  events?: unknown[];
  honesty?: string;
}

export interface SessionResyncRequiredWire {
  msg: "session_resync_required";
  protocol?: number;
  reason: string;
  action?: string;
  honesty?: string;
}

export interface SessionWarningWire {
  msg: "session_warning";
  protocol?: number;
  code: string;
  detail: string;
}

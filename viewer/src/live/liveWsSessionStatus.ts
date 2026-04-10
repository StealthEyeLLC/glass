/**
 * Pure helpers for WebSocket operator UI — close code/reason as received (no invented semantics).
 */

export type WsUiPhase = "idle" | "connecting" | "open";

/** How we attribute a close for operator clarity (not a transport guarantee). */
export type WsCloseInitiator =
  | "operator_disconnect"
  | "replaced_by_new_connect"
  | "after_error_event"
  | "remote_or_peer";

export interface WsLastCloseDisplay {
  initiator: WsCloseInitiator;
  code: number;
  /** Raw CloseEvent.reason (may be empty). */
  reason: string;
  wasClean: boolean;
}

export function resolveCloseInitiator(
  attribution: "operator" | "reconnect" | null,
  hadErrorEvent: boolean,
): WsCloseInitiator {
  if (attribution === "operator") {
    return "operator_disconnect";
  }
  if (attribution === "reconnect") {
    return "replaced_by_new_connect";
  }
  if (hadErrorEvent) {
    return "after_error_event";
  }
  return "remote_or_peer";
}

/** One-line status for the main status strip. */
export function formatWsPhaseLine(phase: WsUiPhase): string {
  switch (phase) {
    case "idle":
      return "WebSocket: idle (not connected)";
    case "connecting":
      return "WebSocket: connecting…";
    case "open":
      return "WebSocket: open — receiving live_session wire";
    default:
      return "WebSocket: unknown phase";
  }
}

/** Human-facing close summary — still reports raw code/reason without claiming health. */
export function formatLastCloseLine(close: WsLastCloseDisplay): string {
  const reasonPart =
    close.reason.trim().length > 0
      ? ` reason=${JSON.stringify(close.reason)}`
      : " (no close reason string)";
  const initiatorPart =
    close.initiator === "operator_disconnect"
      ? "operator disconnect — "
      : close.initiator === "replaced_by_new_connect"
        ? "superseded by new Connect — "
        : close.initiator === "after_error_event"
          ? "after error event — "
          : "peer/unknown — ";
  return `Last WS close: ${initiatorPart}code=${close.code}${reasonPart} wasClean=${close.wasClean}`;
}

export function buildWsStatusJson(payload: {
  phase: WsUiPhase;
  lastClose: WsLastCloseDisplay | null;
  hadUnhandledErrorEvent: boolean;
}): string {
  return JSON.stringify(payload, null, 2);
}

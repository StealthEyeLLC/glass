/**
 * Pure presentation helpers for the live-session shell — deterministic, testable.
 * Does not imply full history or continuity beyond bridge contracts.
 */

import type { LiveSessionModelState } from "./applyLiveSessionMessage.js";
import type { HttpReconcileRecord } from "./liveHttpReconcile.js";
import type { BoundedSnapshotF04 } from "./liveSessionHttp.js";
import type { BridgeCapabilitiesLive } from "./liveCapabilities.js";

export interface LiveStatePresentationDoc {
  sessionId: string;
  boundedEventCount: number;
  lastWireMsg: string | null;
  lastTailMutation: string | null;
  lastWireSummary: string | null;
  lastHttpReconcile: Pick<
    HttpReconcileRecord,
    "trigger" | "status" | "atIso" | "eventsCount"
  > | null;
  lastResyncReason: string | null;
  lastWarning: { code: string; detail: string } | null;
  boundedSampleHonesty: string;
  snapshotMeta: {
    snapshot_cursor?: string;
    snapshot_origin?: string;
    truncated?: boolean;
    events_omitted_from_sample?: number;
  } | null;
}

export function buildLiveStatePresentationDoc(
  model: LiveSessionModelState,
  lastReconcile: HttpReconcileRecord | null,
  lastHttp: BoundedSnapshotF04 | null,
): LiveStatePresentationDoc {
  const lr = model.lastReplaced;
  const boundedSampleHonesty =
    lr?.truncated_by_max_events === true ||
    (typeof lr?.events_omitted_from_sample === "number" &&
      lr.events_omitted_from_sample > 0)
      ? "This list is a bounded sample from the bridge — not full session history."
      : "Tail is still a bounded operator view (WS events_sample + deltas) — not a durability guarantee.";

  return {
    sessionId: model.sessionId,
    boundedEventCount: model.eventTail.length,
    lastWireMsg: model.lastAppliedWire?.msg ?? null,
    lastTailMutation: model.lastAppliedWire?.eventTailMutation ?? null,
    lastWireSummary: model.lastAppliedWire?.summary ?? null,
    lastHttpReconcile: lastReconcile
      ? {
          trigger: lastReconcile.trigger,
          status: lastReconcile.status,
          atIso: lastReconcile.atIso,
          eventsCount: lastReconcile.eventsCount,
        }
      : null,
    lastResyncReason: model.lastResync?.reason ?? null,
    lastWarning: model.lastWarning
      ? { code: model.lastWarning.code, detail: model.lastWarning.detail }
      : null,
    boundedSampleHonesty,
    snapshotMeta: lr
      ? {
          snapshot_cursor: lr.snapshot_cursor,
          snapshot_origin: lr.snapshot_origin,
          truncated: lr.truncated_by_max_events,
          events_omitted_from_sample: lr.events_omitted_from_sample,
        }
      : lastHttp
        ? {
            snapshot_cursor: lastHttp.snapshot_cursor,
            snapshot_origin: lastHttp.bounded_snapshot?.snapshot_origin,
          }
        : null,
  };
}

export function serializePresentationDoc(doc: LiveStatePresentationDoc): string {
  return JSON.stringify(doc, null, 2);
}

/**
 * When preflight succeeded and F-IPC is not configured, block Connect (operator clarity).
 * Failed preflight or missing preflight does not disable — unknown state.
 */
export function liveConnectDisabledFromPreflight(
  capsError: string | null,
  lastCaps: BridgeCapabilitiesLive | null,
): { disabled: boolean; reason: string } {
  if (capsError !== null || lastCaps === null) {
    return { disabled: false, reason: "" };
  }
  if (!lastCaps.collector_fipc.configured) {
    return {
      disabled: true,
      reason:
        "collector_fipc.configured is false — live ingest path unavailable; Connect disabled.",
    };
  }
  return { disabled: false, reason: "" };
}

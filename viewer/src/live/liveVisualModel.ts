/**
 * Pure mapping from live session model → bounded visual spec (Canvas 2D skeleton).
 * Not topology, not full history — bounded tail + last wire semantics only.
 */

import type { LiveSessionModelState } from "./applyLiveSessionMessage.js";
import type { HttpReconcileRecord } from "./liveHttpReconcile.js";

export type LiveVisualMode =
  | "idle"
  | "hello"
  | "replace"
  | "append"
  | "none_delta"
  | "resync"
  | "warning";

export interface LiveVisualSpec {
  mode: LiveVisualMode;
  /** Bounded WS `eventTail` length */
  eventTailCount: number;
  sessionId: string;
  lastWireMsg: string | null;
  lastWireSummary: string | null;
  warningCode: string | null;
  resyncReason: string | null;
  /** One-line last bounded HTTP reconcile (if any) */
  reconcileSummary: string | null;
  /** Always shown as footer honesty */
  honestyLine: string;
  /** `bounded_snapshot.snapshot_origin` or WS replace — null when not yet observed */
  snapshotOriginLabel: string | null;
  /** Replay strip only: prefix length / pack size — null when not in a replay prefix split */
  replayPrefixFraction: number | null;
  /** Drives state rail geometry: live triage lanes vs replay prefix/remainder */
  stripSource: "live" | "replay";
}

/** Fill colors for primary band (deterministic, sRGB hex). */
export const LIVE_VISUAL_MODE_FILL: Record<LiveVisualMode, string> = {
  idle: "#94a3b8",
  hello: "#64748b",
  replace: "#1d4ed8",
  append: "#15803d",
  none_delta: "#78716c",
  resync: "#c2410c",
  warning: "#b91c1c",
};

const HONESTY =
  "Bounded WS tail / samples — not full history, not topology, not continuity guarantees.";

export interface BuildLiveVisualSpecOptions {
  /** When no `session_snapshot_replaced` yet — last HTTP `bounded_snapshot.snapshot_origin` if any */
  httpSnapshotOrigin?: string | null;
}

function snapshotOriginLabelFromModel(
  model: LiveSessionModelState,
  options?: BuildLiveVisualSpecOptions,
): string | null {
  return model.lastReplaced?.snapshot_origin ?? options?.httpSnapshotOrigin ?? null;
}

export function buildLiveVisualSpec(
  model: LiveSessionModelState,
  lastReconcile: HttpReconcileRecord | null,
  options?: BuildLiveVisualSpecOptions,
): LiveVisualSpec {
  const reconcileSummary = lastReconcile
    ? `${lastReconcile.trigger} → ${lastReconcile.status}${
        lastReconcile.eventsCount !== undefined
          ? ` (${lastReconcile.eventsCount} events in HTTP body)`
          : ""
      }`
    : null;

  const base = {
    eventTailCount: model.eventTail.length,
    sessionId: model.sessionId,
    honestyLine: HONESTY,
    reconcileSummary,
    snapshotOriginLabel: snapshotOriginLabelFromModel(model, options),
    replayPrefixFraction: null as number | null,
    stripSource: "live" as const,
  };

  if (model.lastWarning) {
    return {
      ...base,
      mode: "warning",
      lastWireMsg: "session_warning",
      lastWireSummary: model.lastWarning.detail,
      warningCode: model.lastWarning.code,
      resyncReason: null,
    };
  }

  const w = model.lastAppliedWire;
  if (w?.msg === "session_resync_required") {
    return {
      ...base,
      mode: "resync",
      lastWireMsg: w.msg,
      lastWireSummary: w.summary,
      warningCode: null,
      resyncReason: model.lastResync?.reason ?? null,
    };
  }
  if (w?.eventTailMutation === "replace") {
    return {
      ...base,
      mode: "replace",
      lastWireMsg: w.msg,
      lastWireSummary: w.summary,
      warningCode: null,
      resyncReason: null,
    };
  }
  if (w?.eventTailMutation === "append") {
    return {
      ...base,
      mode: "append",
      lastWireMsg: w.msg,
      lastWireSummary: w.summary,
      warningCode: null,
      resyncReason: null,
    };
  }
  if (w?.msg === "session_hello") {
    return {
      ...base,
      mode: "hello",
      lastWireMsg: w.msg,
      lastWireSummary: w.summary,
      warningCode: null,
      resyncReason: null,
    };
  }
  if (w?.msg === "session_delta" && w.eventTailMutation === "none") {
    return {
      ...base,
      mode: "none_delta",
      lastWireMsg: w.msg,
      lastWireSummary: w.summary,
      warningCode: null,
      resyncReason: null,
    };
  }

  return {
    ...base,
    mode: "idle",
    lastWireMsg: w?.msg ?? null,
    lastWireSummary: w?.summary ?? null,
    warningCode: null,
    resyncReason: null,
  };
}

/**
 * Normalized bar width for density strip (0–1), capped so large tails do not imply “full”.
 */
export function liveVisualDensity01(eventTailCount: number, cap: number = 48): number {
  if (cap <= 0) {
    return 0;
  }
  return Math.min(1, eventTailCount / cap);
}

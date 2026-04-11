/**
 * Vertical Slice v4 — bounded scene emphasis and transition steps (pure, deterministic).
 * Pulse steps decay once per compile when the caller passes previous emphasis; bumps apply on
 * real basis changes only — no idle animation, no invented history.
 */

import type { LiveVisualMode } from "../live/liveVisualModel.js";
import type { SceneSource } from "./glassSceneV0.js";

export type ReplayLoadPhaseForEmphasis = "none" | "idle" | "reading" | "ready" | "error";

/** Snapshot of facts used for emphasis — mirrors scene fields, no renderer/DOM. */
export interface SceneEmphasisSnapshot {
  source: SceneSource;
  wireMode: LiveVisualMode;
  boundedSampleCount: number;
  warningCode: string | null;
  resyncReason: string | null;
  reconcileSummary: string | null;
  snapshotOriginLabel: string | null;
  replayCursorIndex: number | null;
  replayEventTotal: number | null;
  replayPhase: ReplayLoadPhaseForEmphasis;
}

export interface BoundedSceneEmphasisV0 {
  /** Last basis used for transition detection (carried forward by caller). */
  basis: SceneEmphasisSnapshot;
  /** Decaying pulse after wire mode change (replace/append/resync/…). */
  wirePulseStep: 0 | 1 | 2 | 3;
  /** Decaying pulse after bounded sample depth / tail length increased or replay prefix moved. */
  samplePulseStep: 0 | 1 | 2 | 3;
  /** Decaying flash when resync reason becomes active / changes. */
  resyncFlashStep: 0 | 1 | 2 | 3;
  /** Decaying flash for warning / reconcile attention. */
  systemFlashStep: 0 | 1 | 2 | 3;
  /** Replay-only: cursor index changed while ready. */
  replayCursorPulseStep: 0 | 1 | 2;
  /** Normalized region weights for composition underlays (static + flash boost). */
  regionWeightPrimary: number;
  regionWeightSystem: number;
  regionWeightEvidence: number;
}

function clamp3(n: number): 0 | 1 | 2 | 3 {
  if (n <= 0) {
    return 0;
  }
  if (n >= 3) {
    return 3;
  }
  return n as 1 | 2 | 3;
}

function clamp2(n: number): 0 | 1 | 2 {
  if (n <= 0) {
    return 0;
  }
  if (n >= 2) {
    return 2;
  }
  return 1;
}

function decay3(s: 0 | 1 | 2 | 3): 0 | 1 | 2 | 3 {
  return s <= 0 ? 0 : ((s - 1) as 0 | 1 | 2 | 3);
}

function decay2(s: 0 | 1 | 2): 0 | 1 | 2 {
  return s <= 0 ? 0 : ((s - 1) as 0 | 1 | 2);
}

function normalizeWeights(p: number, s: number, e: number): { p: number; sy: number; e: number } {
  const sum = p + s + e;
  if (sum <= 0) {
    return { p: 1 / 3, sy: 1 / 3, e: 1 / 3 };
  }
  return { p: p / sum, sy: s / sum, e: e / sum };
}

function staticRegionWeights(
  mode: LiveVisualMode,
  resyncFlash: number,
  systemFlash: number,
): { p: number; sy: number; e: number } {
  let p = 0.42;
  let s = 0.33;
  let e = 0.25;
  if (mode === "replace" || mode === "append") {
    p = 0.55;
    s = 0.28;
    e = 0.17;
  }
  if (mode === "resync" || mode === "warning") {
    p = 0.3;
    s = 0.52;
    e = 0.18;
  }
  if (mode === "idle" || mode === "hello" || mode === "none_delta") {
    p = 0.38;
    s = 0.32;
    e = 0.3;
  }
  s += 0.04 * Math.min(3, resyncFlash);
  s += 0.035 * Math.min(3, systemFlash);
  return normalizeWeights(p, s, e);
}

function basisEqual(a: SceneEmphasisSnapshot, b: SceneEmphasisSnapshot): boolean {
  return (
    a.source === b.source &&
    a.wireMode === b.wireMode &&
    a.boundedSampleCount === b.boundedSampleCount &&
    (a.warningCode ?? "") === (b.warningCode ?? "") &&
    (a.resyncReason ?? "") === (b.resyncReason ?? "") &&
    (a.reconcileSummary ?? "") === (b.reconcileSummary ?? "") &&
    (a.snapshotOriginLabel ?? "") === (b.snapshotOriginLabel ?? "") &&
    a.replayCursorIndex === b.replayCursorIndex &&
    a.replayEventTotal === b.replayEventTotal &&
    a.replayPhase === b.replayPhase
  );
}

/**
 * Pure emphasis + bounded pulse steps. Pass `previous` from the last compile output (or null).
 */
export function computeBoundedSceneEmphasis(
  snapshot: SceneEmphasisSnapshot,
  previous: BoundedSceneEmphasisV0 | null,
): BoundedSceneEmphasisV0 {
  const prevBasis = previous?.basis ?? null;

  let wirePulse = decay3(previous?.wirePulseStep ?? 0);
  let samplePulse = decay3(previous?.samplePulseStep ?? 0);
  let resyncFlash = decay3(previous?.resyncFlashStep ?? 0);
  let systemFlash = decay3(previous?.systemFlashStep ?? 0);
  let replayCursorPulse = decay2(previous?.replayCursorPulseStep ?? 0);

  if (prevBasis !== null && !basisEqual(prevBasis, snapshot)) {
    if (prevBasis.wireMode !== snapshot.wireMode) {
      wirePulse = 3;
    }

    if (snapshot.source === "live") {
      if (snapshot.boundedSampleCount > prevBasis.boundedSampleCount) {
        samplePulse = 3;
      }
    } else if (snapshot.replayPhase === "ready" && prevBasis.replayPhase === "ready") {
      if (snapshot.boundedSampleCount !== prevBasis.boundedSampleCount) {
        samplePulse = 3;
      }
      if (
        prevBasis.replayCursorIndex !== null &&
        snapshot.replayCursorIndex !== null &&
        prevBasis.replayCursorIndex !== snapshot.replayCursorIndex
      ) {
        replayCursorPulse = 2;
      }
    }

    const resyncPrev = prevBasis.resyncReason ?? "";
    const resyncNext = snapshot.resyncReason ?? "";
    if (resyncNext.length > 0 && resyncNext !== resyncPrev) {
      resyncFlash = 3;
    }

    const warnPrev = prevBasis.warningCode ?? "";
    const warnNext = snapshot.warningCode ?? "";
    if (warnNext.length > 0 && warnNext !== warnPrev) {
      systemFlash = 3;
    }

    const recPrev = prevBasis.reconcileSummary ?? "";
    const recNext = snapshot.reconcileSummary ?? "";
    if (recNext.length > 0 && recNext !== recPrev) {
      systemFlash = 3;
    }
  }

  const rw = staticRegionWeights(snapshot.wireMode, resyncFlash, systemFlash);

  return {
    basis: snapshot,
    wirePulseStep: clamp3(wirePulse),
    samplePulseStep: clamp3(samplePulse),
    resyncFlashStep: clamp3(resyncFlash),
    systemFlashStep: clamp3(systemFlash),
    replayCursorPulseStep: clamp2(replayCursorPulse),
    regionWeightPrimary: rw.p,
    regionWeightSystem: rw.sy,
    regionWeightEvidence: rw.e,
  };
}

/** Short summary for Canvas overlay (bounded facts only). */
export function formatBoundedEmphasisSummary(e: BoundedSceneEmphasisV0): string {
  const parts: string[] = [];
  if (e.wirePulseStep > 0) {
    parts.push(`wire×${e.wirePulseStep}`);
  }
  if (e.samplePulseStep > 0) {
    parts.push(`sample×${e.samplePulseStep}`);
  }
  if (e.resyncFlashStep > 0) {
    parts.push(`resync×${e.resyncFlashStep}`);
  }
  if (e.systemFlashStep > 0) {
    parts.push(`system×${e.systemFlashStep}`);
  }
  if (e.replayCursorPulseStep > 0) {
    parts.push(`cursor×${e.replayCursorPulseStep}`);
  }
  return parts.join(" ");
}

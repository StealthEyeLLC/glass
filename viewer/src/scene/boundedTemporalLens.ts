/**
 * Vertical Slice v11 — bounded temporal lens (pure, deterministic).
 * Uses only viewer-held recent bounded frames (replay/live paints) — not server full history.
 */

import type { GlassSceneV0 } from "./glassSceneV0.js";

export const BOUNDED_TEMPORAL_LENS_KIND = "glass.temporal_lens.v0" as const;

/** Max recent bounded paints kept in the lens ring (viewer memory only). */
export const BOUNDED_TEMPORAL_RING_MAX = 5 as const;

export const BOUNDED_TEMPORAL_STEP_NEIGHBOR_DEFAULT = 2 as const;

export interface BoundedTemporalLensHonestyV0 {
  readonly line: string;
}

export interface BoundedTemporalStepChipV0 {
  readonly eventIndex: number;
  /** 1-based display index for operator clarity */
  readonly displayOrdinal: number;
  readonly isCurrent: boolean;
}

export interface BoundedTemporalRingEntryV0 {
  readonly ringIndex: number;
  readonly fingerprint: string;
  readonly isCurrent: boolean;
  /** True when this ring slot is the active compare baseline. */
  readonly isActiveBaseline: boolean;
}

export interface BoundedTemporalLensViewV0 {
  readonly kind: typeof BOUNDED_TEMPORAL_LENS_KIND;
  readonly honesty: BoundedTemporalLensHonestyV0;
  /** Replay only — index-ordered steps near the scrub cursor (not a full timeline). */
  readonly stepChips: readonly BoundedTemporalStepChipV0[];
  /** Recent bounded paints (oldest → newest); last is always current. */
  readonly ringEntries: readonly BoundedTemporalRingEntryV0[];
  readonly baselineHonestyNote: string | null;
  readonly showResetBaseline: boolean;
}

const HONESTY_REPLAY =
  "Replay: step chips are pack indices near the scrub cursor; paint ring is the last few bounded frames this viewer actually painted (not full history).";

const HONESTY_LIVE =
  "Live: paint ring is the last few bounded frames this viewer painted (WS tail + compile — not a durable server log).";

export function pushBoundedTemporalRing(
  ring: readonly GlassSceneV0[],
  newest: GlassSceneV0,
  max: number = BOUNDED_TEMPORAL_RING_MAX,
): GlassSceneV0[] {
  const next = [...ring, newest];
  if (next.length <= max) {
    return next;
  }
  return next.slice(next.length - max);
}

/** Short deterministic line for chips — no topology, no causal chain. */
export function formatBoundedSceneTemporalFingerprint(scene: GlassSceneV0): string {
  const mode = scene.wireMode;
  const n = scene.boundedSampleCount;
  const d = scene.density01;
  return `n=${n} · ρ=${d.toFixed(2)} · ${mode}`;
}

/**
 * Compare baseline for bounded compare/evidence: `baseline` vs current (`ring` last).
 * `explicitBaselineIndex === null` → immediate prior paint in the ring (`ring[length-2]`).
 */
export function resolveCompareBaselineFromRing(
  ring: readonly GlassSceneV0[],
  explicitBaselineIndex: number | null,
): { baseline: GlassSceneV0 | null; honestyNote: string | null } {
  if (ring.length < 2) {
    return {
      baseline: null,
      honestyNote:
        ring.length === 0
          ? "No bounded paints in the lens yet."
          : "Only one bounded paint in the lens — compare needs a prior frame.",
    };
  }
  const curIdx = ring.length - 1;
  if (explicitBaselineIndex === null) {
    const b = ring[curIdx - 1];
    return b ? { baseline: b, honestyNote: null } : { baseline: null, honestyNote: "No immediate prior frame." };
  }
  if (explicitBaselineIndex < 0 || explicitBaselineIndex > curIdx - 1) {
    return {
      baseline: null,
      honestyNote: "That baseline is outside the current bounded lens.",
    };
  }
  const b = ring[explicitBaselineIndex];
  return b ? { baseline: b, honestyNote: null } : { baseline: null, honestyNote: "Missing baseline slot." };
}

/**
 * Clamp user-selected baseline index when the ring shrinks or replays reset.
 */
export function clampTemporalBaselineIndex(
  ringLength: number,
  selected: number | null,
): number | null {
  if (selected === null || ringLength < 2) {
    return null;
  }
  const maxBaseline = ringLength - 2;
  if (maxBaseline < 0) {
    return null;
  }
  if (selected < 0 || selected > maxBaseline) {
    return null;
  }
  return selected;
}

/** Replay: indices within [cursor ± neighborCount] clipped to pack bounds. */
export function computeReplayStepNeighborhood(
  cursorIndex: number,
  eventCount: number,
  neighborCount: number = BOUNDED_TEMPORAL_STEP_NEIGHBOR_DEFAULT,
): BoundedTemporalStepChipV0[] {
  if (eventCount <= 0 || cursorIndex < 0 || cursorIndex >= eventCount) {
    return [];
  }
  const lo = Math.max(0, cursorIndex - neighborCount);
  const hi = Math.min(eventCount - 1, cursorIndex + neighborCount);
  const out: BoundedTemporalStepChipV0[] = [];
  for (let i = lo; i <= hi; i++) {
    out.push({
      eventIndex: i,
      displayOrdinal: i + 1,
      isCurrent: i === cursorIndex,
    });
  }
  return out;
}

export function buildReplayTemporalLensView(
  ring: readonly GlassSceneV0[],
  cursorIndex: number,
  eventCount: number,
  selectedBaselineRingIndex: number | null,
): BoundedTemporalLensViewV0 {
  const stepChips = computeReplayStepNeighborhood(
    cursorIndex,
    eventCount,
    BOUNDED_TEMPORAL_STEP_NEIGHBOR_DEFAULT,
  );
  const { baseline, honestyNote } = resolveCompareBaselineFromRing(ring, selectedBaselineRingIndex);
  const ringEntries: BoundedTemporalRingEntryV0[] = ring.map((scene, ringIndex) => {
    const isCurrent = ringIndex === ring.length - 1;
    let isActiveBaseline = false;
    if (baseline && ring.length >= 2) {
      if (selectedBaselineRingIndex === null) {
        isActiveBaseline = ringIndex === ring.length - 2;
      } else {
        isActiveBaseline = ringIndex === selectedBaselineRingIndex;
      }
    }
    return {
      ringIndex,
      fingerprint: formatBoundedSceneTemporalFingerprint(scene),
      isCurrent,
      isActiveBaseline,
    };
  });
  return {
    kind: BOUNDED_TEMPORAL_LENS_KIND,
    honesty: { line: HONESTY_REPLAY },
    stepChips,
    ringEntries,
    baselineHonestyNote: honestyNote,
    showResetBaseline: selectedBaselineRingIndex !== null && ring.length >= 2,
  };
}

export function buildLiveTemporalLensView(
  ring: readonly GlassSceneV0[],
  selectedBaselineRingIndex: number | null,
): BoundedTemporalLensViewV0 {
  const { baseline, honestyNote } = resolveCompareBaselineFromRing(ring, selectedBaselineRingIndex);
  const ringEntries: BoundedTemporalRingEntryV0[] = ring.map((scene, ringIndex) => {
    const isCurrent = ringIndex === ring.length - 1;
    let isActiveBaseline = false;
    if (baseline && ring.length >= 2) {
      if (selectedBaselineRingIndex === null) {
        isActiveBaseline = ringIndex === ring.length - 2;
      } else {
        isActiveBaseline = ringIndex === selectedBaselineRingIndex;
      }
    }
    return {
      ringIndex,
      fingerprint: formatBoundedSceneTemporalFingerprint(scene),
      isCurrent,
      isActiveBaseline,
    };
  });
  return {
    kind: BOUNDED_TEMPORAL_LENS_KIND,
    honesty: { line: HONESTY_LIVE },
    stepChips: [],
    ringEntries,
    baselineHonestyNote: honestyNote,
    showResetBaseline: selectedBaselineRingIndex !== null && ring.length >= 2,
  };
}

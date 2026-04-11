import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import {
  BOUNDED_TEMPORAL_RING_MAX,
  buildLiveTemporalLensView,
  buildReplayTemporalLensView,
  clampTemporalBaselineIndex,
  computeReplayStepNeighborhood,
  formatBoundedSceneTemporalFingerprint,
  pushBoundedTemporalRing,
  resolveCompareBaselineFromRing,
} from "./boundedTemporalLens.js";

function liveSceneFromTail(n: number) {
  const m = createInitialLiveSessionModelState("s-t");
  m.eventTail = Array.from({ length: n }, (_, i) => ({
    kind: "process_poll_sample",
    seq: i + 1,
  }));
  return compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
}

describe("pushBoundedTemporalRing", () => {
  it("appends and caps at max", () => {
    const a = liveSceneFromTail(1);
    const b = liveSceneFromTail(2);
    const c = liveSceneFromTail(3);
    const d = liveSceneFromTail(4);
    const e = liveSceneFromTail(5);
    const f = liveSceneFromTail(6);
    let r = pushBoundedTemporalRing([], a, BOUNDED_TEMPORAL_RING_MAX);
    r = pushBoundedTemporalRing(r, b, BOUNDED_TEMPORAL_RING_MAX);
    r = pushBoundedTemporalRing(r, c, BOUNDED_TEMPORAL_RING_MAX);
    r = pushBoundedTemporalRing(r, d, BOUNDED_TEMPORAL_RING_MAX);
    r = pushBoundedTemporalRing(r, e, BOUNDED_TEMPORAL_RING_MAX);
    r = pushBoundedTemporalRing(r, f, BOUNDED_TEMPORAL_RING_MAX);
    expect(r.length).toBe(BOUNDED_TEMPORAL_RING_MAX);
    expect(r[BOUNDED_TEMPORAL_RING_MAX - 1]?.boundedSampleCount).toBe(f.boundedSampleCount);
  });
});

describe("resolveCompareBaselineFromRing", () => {
  it("uses immediate prior when explicit is null", () => {
    const a = liveSceneFromTail(1);
    const b = liveSceneFromTail(2);
    const r = resolveCompareBaselineFromRing([a, b], null);
    expect(r.baseline).toBe(a);
    expect(r.honestyNote).toBeNull();
  });

  it("is honest with one entry", () => {
    const a = liveSceneFromTail(1);
    const r = resolveCompareBaselineFromRing([a], null);
    expect(r.baseline).toBeNull();
    expect(r.honestyNote).toContain("Only one");
  });

  it("selects explicit baseline index", () => {
    const a = liveSceneFromTail(1);
    const b = liveSceneFromTail(2);
    const c = liveSceneFromTail(3);
    const r = resolveCompareBaselineFromRing([a, b, c], 0);
    expect(r.baseline).toBe(a);
    expect(r.honestyNote).toBeNull();
  });

  it("rejects baseline === current index", () => {
    const a = liveSceneFromTail(1);
    const b = liveSceneFromTail(2);
    const r = resolveCompareBaselineFromRing([a, b], 1);
    expect(r.baseline).toBeNull();
    expect(r.honestyNote).toContain("outside");
  });
});

describe("clampTemporalBaselineIndex", () => {
  it("null stays null when ring short", () => {
    expect(clampTemporalBaselineIndex(1, null)).toBeNull();
  });

  it("invalid explicit becomes null", () => {
    expect(clampTemporalBaselineIndex(2, 5)).toBeNull();
  });
});

describe("computeReplayStepNeighborhood", () => {
  it("clips to pack bounds", () => {
    const chips = computeReplayStepNeighborhood(0, 3, 2);
    expect(chips.map((c) => c.eventIndex)).toEqual([0, 1, 2]);
    expect(chips.filter((c) => c.isCurrent).map((c) => c.eventIndex)).toEqual([0]);
  });

  it("centers on cursor", () => {
    const chips = computeReplayStepNeighborhood(5, 10, 1);
    expect(chips.some((c) => c.eventIndex === 5 && c.isCurrent)).toBe(true);
  });
});

describe("buildReplayTemporalLensView", () => {
  it("marks current step and ring current", () => {
    const s0 = liveSceneFromTail(1);
    const s1 = liveSceneFromTail(2);
    const v = buildReplayTemporalLensView([s0, s1], 1, 3, null);
    expect(v.stepChips.some((c) => c.isCurrent && c.eventIndex === 1)).toBe(true);
    expect(v.ringEntries[v.ringEntries.length - 1]?.isCurrent).toBe(true);
    expect(v.honesty.lineSimple.length).toBeGreaterThan(10);
    expect(v.honesty.line.length).toBeGreaterThan(10);
  });
});

describe("buildLiveTemporalLensView", () => {
  it("has no step chips", () => {
    const a = liveSceneFromTail(1);
    const b = liveSceneFromTail(2);
    const v = buildLiveTemporalLensView([a, b], null);
    expect(v.stepChips.length).toBe(0);
    expect(v.ringEntries.length).toBe(2);
  });
});

describe("formatBoundedSceneTemporalFingerprint", () => {
  it("is deterministic", () => {
    const s = liveSceneFromTail(2);
    expect(formatBoundedSceneTemporalFingerprint(s)).toContain("n=2");
  });
});

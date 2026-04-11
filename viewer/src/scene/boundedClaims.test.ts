import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { computeBoundedEvidenceDrilldown } from "./boundedEvidenceDrilldown.js";
import { computeBoundedSceneCompare } from "./boundedSceneCompare.js";
import { computeBoundedSceneEpisodes } from "./boundedEpisodes.js";
import {
  boundedClaimEvidenceUiLines,
  boundedClaimSelectionStillValid,
  buildBoundedClaimReceipt,
  computeBoundedSceneClaims,
  resolvePrimaryClaimId,
} from "./boundedClaims.js";
import { renderBoundedClaimReceiptInto, renderBoundedClaimsInto } from "./boundedClaimsPanel.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import { liveVisualSpecFromScene } from "./sceneToLiveVisualSpec.js";

function sceneFromTail(len: number) {
  const m = createInitialLiveSessionModelState("s-claim");
  m.eventTail = Array.from({ length: len }, (_, i) => ({
    kind: "process_poll_sample",
    seq: i + 1,
  }));
  return compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
}

describe("computeBoundedSceneClaims", () => {
  it("produces unavailable baseline claim when compare has no prior", () => {
    const cur = sceneFromTail(1);
    const cmp = computeBoundedSceneCompare(null, cur, { selectedId: null });
    const episodes = computeBoundedSceneEpisodes({
      path: "live",
      currentScene: cur,
      baselineScene: null,
      immediatePriorScene: null,
      compare: cmp,
      selectedSelectionId: null,
      liveEventTailMutation: null,
      compareBaselineIsImmediatePrior: true,
    });
    const spec = liveVisualSpecFromScene(cur, null, { previousScene: null, compare: cmp });
    const drill = computeBoundedEvidenceDrilldown({
      scene: cur,
      spec,
      compare: cmp,
      selectedSelectionId: null,
      previousBoundedSampleCount: null,
      liveEventTail: [],
      replay: null,
    });
    const pack = computeBoundedSceneClaims({
      path: "live",
      scene: cur,
      compare: cmp,
      episodes,
      drilldown: drill,
      selectedSelectionId: null,
      selectedEpisodeId: null,
      liveEventTailMutation: null,
    });
    expect(pack.claims[0]?.kind).toBe("no_compare_baseline");
    expect(pack.claims[0]?.status).toBe("unavailable");
  });

  it("live: append growth uses observed when wire reports append", () => {
    const prev = sceneFromTail(2);
    const cur = sceneFromTail(5);
    const cmp = computeBoundedSceneCompare(prev, cur, { selectedId: null });
    const episodes = computeBoundedSceneEpisodes({
      path: "live",
      currentScene: cur,
      baselineScene: prev,
      immediatePriorScene: prev,
      compare: cmp,
      selectedSelectionId: null,
      liveEventTailMutation: "append",
      compareBaselineIsImmediatePrior: true,
    });
    const spec = liveVisualSpecFromScene(cur, null, { previousScene: prev, compare: cmp });
    const drill = computeBoundedEvidenceDrilldown({
      scene: cur,
      spec,
      compare: cmp,
      selectedSelectionId: null,
      previousBoundedSampleCount: prev.boundedSampleCount,
      liveEventTail: [{ kind: "process_poll_sample", seq: 1 }],
      replay: null,
    });
    const pack = computeBoundedSceneClaims({
      path: "live",
      scene: cur,
      compare: cmp,
      episodes,
      drilldown: drill,
      selectedSelectionId: null,
      selectedEpisodeId: null,
      liveEventTailMutation: "append",
    });
    const append = pack.claims.find((c) => c.kind === "append_growth");
    expect(append?.status).toBe("observed");
  });

  it("resolvePrimaryClaimId follows selected episode when present", () => {
    const prev = sceneFromTail(2);
    const cur = sceneFromTail(5);
    const cmp = computeBoundedSceneCompare(prev, cur, { selectedId: null });
    const episodes = computeBoundedSceneEpisodes({
      path: "live",
      currentScene: cur,
      baselineScene: prev,
      immediatePriorScene: prev,
      compare: cmp,
      selectedSelectionId: null,
      liveEventTailMutation: "append",
      compareBaselineIsImmediatePrior: true,
    });
    const ep0 = episodes.episodes[0];
    expect(ep0).toBeDefined();
    const spec = liveVisualSpecFromScene(cur, null, { previousScene: prev, compare: cmp });
    const drill = computeBoundedEvidenceDrilldown({
      scene: cur,
      spec,
      compare: cmp,
      selectedSelectionId: null,
      previousBoundedSampleCount: prev.boundedSampleCount,
      liveEventTail: [],
      replay: null,
    });
    const pack = computeBoundedSceneClaims({
      path: "live",
      scene: cur,
      compare: cmp,
      episodes,
      drilldown: drill,
      selectedSelectionId: null,
      selectedEpisodeId: ep0?.id ?? null,
      liveEventTailMutation: "append",
    });
    const primary = resolvePrimaryClaimId(pack.claims, ep0?.id ?? null);
    expect(primary).toBe(pack.claims.find((c) => c.relatedEpisodeId === ep0?.id)?.id ?? null);
  });
});

describe("boundedClaimSelectionStillValid", () => {
  it("returns false when id missing", () => {
    expect(boundedClaimSelectionStillValid([], "claim-v13:x:0")).toBe(false);
  });
});

describe("buildBoundedClaimReceipt + boundedClaimEvidenceUiLines", () => {
  it("returns evidence UI lines for a receipt", () => {
    const prev = sceneFromTail(2);
    const cur = sceneFromTail(5);
    const cmp = computeBoundedSceneCompare(prev, cur, { selectedId: null });
    const episodes = computeBoundedSceneEpisodes({
      path: "live",
      currentScene: cur,
      baselineScene: prev,
      immediatePriorScene: prev,
      compare: cmp,
      selectedSelectionId: null,
      liveEventTailMutation: "append",
      compareBaselineIsImmediatePrior: true,
    });
    const spec = liveVisualSpecFromScene(cur, null, { previousScene: prev, compare: cmp });
    const drill = computeBoundedEvidenceDrilldown({
      scene: cur,
      spec,
      compare: cmp,
      selectedSelectionId: null,
      previousBoundedSampleCount: prev.boundedSampleCount,
      liveEventTail: [],
      replay: null,
    });
    const pack = computeBoundedSceneClaims({
      path: "live",
      scene: cur,
      compare: cmp,
      episodes,
      drilldown: drill,
      selectedSelectionId: null,
      selectedEpisodeId: null,
      liveEventTailMutation: "append",
    });
    const claim = pack.claims[0];
    expect(claim).toBeDefined();
    if (!claim) {
      return;
    }
    const r = buildBoundedClaimReceipt(claim, drill, cur);
    expect(r?.boundedSourceLine).toBe(cur.honesty.line);
    const lines = boundedClaimEvidenceUiLines(r);
    expect(lines.contextLine).toMatch(/^Bounded claim:/);
    expect(lines.doesNotImplyLine).toMatch(/^Does not imply:/);
  });
});

describe("renderBoundedClaimsInto / renderBoundedClaimReceiptInto", () => {
  it("renders claim chips and receipt with test ids", () => {
    const prev = sceneFromTail(2);
    const cur = sceneFromTail(5);
    const cmp = computeBoundedSceneCompare(prev, cur, { selectedId: null });
    const episodes = computeBoundedSceneEpisodes({
      path: "live",
      currentScene: cur,
      baselineScene: prev,
      immediatePriorScene: prev,
      compare: cmp,
      selectedSelectionId: null,
      liveEventTailMutation: "append",
      compareBaselineIsImmediatePrior: true,
    });
    const spec = liveVisualSpecFromScene(cur, null, { previousScene: prev, compare: cmp });
    const drill = computeBoundedEvidenceDrilldown({
      scene: cur,
      spec,
      compare: cmp,
      selectedSelectionId: null,
      previousBoundedSampleCount: prev.boundedSampleCount,
      liveEventTail: [],
      replay: null,
    });
    const pack = computeBoundedSceneClaims({
      path: "live",
      scene: cur,
      compare: cmp,
      episodes,
      drilldown: drill,
      selectedSelectionId: null,
      selectedEpisodeId: null,
      liveEventTailMutation: "append",
    });
    const strip = document.createElement("div");
    renderBoundedClaimsInto(strip, pack, {
      testIdPrefix: "replay",
      highlightClaimId: pack.primaryClaimId,
      onSelectClaim: () => {},
    });
    expect(strip.querySelector('[data-testid="replay-bounded-claims-row"]')).toBeTruthy();
    const receiptRoot = document.createElement("div");
    const rec = buildBoundedClaimReceipt(pack.claims[0] ?? null, drill, cur);
    renderBoundedClaimReceiptInto(receiptRoot, rec, { testIdPrefix: "replay" });
    expect(receiptRoot.querySelector('[data-testid="replay-bounded-claim-receipt"]')).toBeTruthy();
  });
});

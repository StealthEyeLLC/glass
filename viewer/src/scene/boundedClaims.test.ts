import { describe, expect, it } from "vitest";
import { VERTICAL_SLICE_V27_RECEIPT_EMPTY_SIMPLE } from "../app/verticalSliceV0.js";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { computeBoundedEvidenceDrilldown } from "./boundedEvidenceDrilldown.js";
import { computeBoundedSceneCompare } from "./boundedSceneCompare.js";
import { computeBoundedSceneEpisodes } from "./boundedEpisodes.js";
import {
  BOUNDED_RECEIPT_SCHEMA_VERSION,
  boundedClaimEvidenceUiLines,
  boundedClaimSelectionStillValid,
  formatBoundedClaimChipStatusShort,
  buildBoundedClaimReceipt,
  computeBoundedSceneClaims,
  resolvePrimaryClaimId,
  type BoundedClaimV0,
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

function stubClaim(p: Partial<BoundedClaimV0> & Pick<BoundedClaimV0, "id" | "kind">): BoundedClaimV0 {
  return {
    title: "t",
    statement: "s",
    status: "observed",
    evidenceRefs: [],
    supportingEvidenceRowIndices: [],
    supportingFactIndices: [],
    evidenceRefKeys: [],
    doesNotImply: "d",
    relatedEpisodeId: null,
    suggestedSelectionId: null,
    honestyNote: null,
    ...p,
  };
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
    expect(pack.claims[0]?.supportingEvidenceRowIndices).toEqual([]);
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
    expect(append?.evidenceRefKeys.some((k) => k.startsWith("fact:"))).toBe(true);
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

  it("resolvePrimaryClaimId prefers selection/cluster claims when a cluster is selected", () => {
    const claims = [
      stubClaim({ id: "a", kind: "append_growth" }),
      stubClaim({ id: "b", kind: "selection_linked_change" }),
    ];
    expect(resolvePrimaryClaimId(claims, null, "glass.sel.v0:cluster:cl_process")).toBe("b");
  });
});

describe("boundedClaimSelectionStillValid", () => {
  it("returns false when id missing", () => {
    expect(boundedClaimSelectionStillValid([], "claim-v14:x:0")).toBe(false);
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
    const r = buildBoundedClaimReceipt(claim, drill, cur, {
      compare: cmp,
      selectedSelectionId: null,
      selectedEpisodeId: null,
      episodes,
    });
    expect(r?.boundedSourceLine).toBe(cur.honesty.line);
    expect(r?.schemaVersion).toBe(BOUNDED_RECEIPT_SCHEMA_VERSION);
    expect(r?.receiptId).toMatch(/^receipt-v14:/);
    expect(r?.evidenceRefKeys.length).toBeGreaterThan(0);
    const lines = boundedClaimEvidenceUiLines(r);
    expect(lines.contextLine).toMatch(/^receipt-v14:/);
    expect(lines.contextLine).toMatch(/Bounded claim:/);
    expect(lines.doesNotImplyLine).toMatch(/^Does not imply:/);
  });

  it("unavailable baseline receipt carries explicit weakness note", () => {
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
    const claim = pack.claims[0];
    expect(claim?.status).toBe("unavailable");
    if (!claim) {
      return;
    }
    const r = buildBoundedClaimReceipt(claim, drill, cur, { compare: cmp, episodes });
    expect(r?.weaknessOrUnavailableNote).toBeTruthy();
    expect(r?.supportBullets.length).toBeGreaterThan(0);
    expect(r?.supportBullets.some((b) => /Fact\[\d+\]:/i.test(b))).toBe(true);
  });
});

describe("renderBoundedClaimsInto / renderBoundedClaimReceiptInto", () => {
  it("renders empty receipt with explicit copy", () => {
    const root = document.createElement("div");
    renderBoundedClaimReceiptInto(root, null, { testIdPrefix: "replay" });
    const empty = root.querySelector('[data-testid="replay-bounded-claim-receipt-empty"]');
    expect(empty?.textContent).toBe(VERTICAL_SLICE_V27_RECEIPT_EMPTY_SIMPLE);
  });

  it("renders empty receipt supplement when temporal baseline handoff applies (v20)", () => {
    const root = document.createElement("div");
    renderBoundedClaimReceiptInto(root, null, {
      testIdPrefix: "replay",
      emptySupplementLine: "Compare baseline changed — next.",
    });
    expect(root.querySelector('[data-testid="replay-bounded-claim-receipt-empty-supplement"]')?.textContent).toBe(
      "Compare baseline changed — next.",
    );
  });

  it("renders structured receipt with trust tier and section markers", () => {
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
    const receiptRoot = document.createElement("div");
    const rec = buildBoundedClaimReceipt(pack.claims[0] ?? null, drill, cur, {
      compare: cmp,
      episodes,
    });
    renderBoundedClaimReceiptInto(receiptRoot, rec, { testIdPrefix: "replay" });
    const wrap = receiptRoot.querySelector('[data-testid="replay-bounded-claim-receipt"]');
    expect(wrap?.getAttribute("data-trust-tier")).toMatch(/^(firm|weak|unavailable)$/);
    expect(wrap?.querySelector('[data-section="scope"]')).toBeTruthy();
    expect(wrap?.querySelector('[data-section="support"]')).toBeTruthy();
    expect(wrap?.querySelector('[data-section="refs"]')).toBeTruthy();
    expect(wrap?.querySelector('[data-section="limits"]')).toBeTruthy();
  });

  it("unavailable baseline receipt exposes limitation node and unavailable tier", () => {
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
    const claim = pack.claims[0];
    expect(claim?.status).toBe("unavailable");
    if (!claim) {
      return;
    }
    const r = buildBoundedClaimReceipt(claim, drill, cur, { compare: cmp, episodes });
    const receiptRoot = document.createElement("div");
    renderBoundedClaimReceiptInto(receiptRoot, r, { testIdPrefix: "replay" });
    const wrap = receiptRoot.querySelector('[data-testid="replay-bounded-claim-receipt"]');
    expect(wrap?.getAttribute("data-trust-tier")).toBe("unavailable");
    expect(receiptRoot.querySelector('[data-testid="replay-bounded-claim-receipt-limitation"]')).toBeTruthy();
  });

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
    const rec = buildBoundedClaimReceipt(pack.claims[0] ?? null, drill, cur, {
      compare: cmp,
      episodes,
    });
    renderBoundedClaimReceiptInto(receiptRoot, rec, { testIdPrefix: "replay" });
    expect(receiptRoot.querySelector('[data-testid="replay-bounded-claim-receipt"]')).toBeTruthy();
    expect(receiptRoot.querySelector('[data-testid="replay-bounded-claim-receipt-keys"]')).toBeTruthy();
  });
});

describe("formatBoundedClaimChipStatusShort (Vertical Slice v19)", () => {
  it("maps statuses to compact operator-facing labels", () => {
    expect(formatBoundedClaimChipStatusShort("observed")).toBe("Observed");
    expect(formatBoundedClaimChipStatusShort("inferred_from_bounded_change")).toBe(
      "Inferred (bounded change)",
    );
    expect(formatBoundedClaimChipStatusShort("weak")).toBe("Weak");
    expect(formatBoundedClaimChipStatusShort("unavailable")).toBe("Unavailable");
  });
});

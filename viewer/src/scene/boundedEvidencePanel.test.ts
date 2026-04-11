import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { computeBoundedEvidenceDrilldown } from "./boundedEvidenceDrilldown.js";
import { computeBoundedSceneCompare } from "./boundedSceneCompare.js";
import { boundedEvidenceRowLabelCaption, renderBoundedEvidenceInto } from "./boundedEvidencePanel.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import { liveVisualSpecFromScene } from "./sceneToLiveVisualSpec.js";

describe("boundedEvidenceRowLabelCaption", () => {
  it("maps bounded row labels to calm captions", () => {
    expect(boundedEvidenceRowLabelCaption("live_tail")).toBe("Live tail sample");
    expect(boundedEvidenceRowLabelCaption("replay_prefix")).toBe("Replay prefix");
    expect(boundedEvidenceRowLabelCaption("current_step")).toBe("Current replay step");
    expect(boundedEvidenceRowLabelCaption("changed")).toBe("Changed vs prior frame");
    expect(boundedEvidenceRowLabelCaption("sampled")).toBe("Cluster-filtered sample");
    expect(boundedEvidenceRowLabelCaption("fact_only")).toBe("Fact line");
  });
});

describe("renderBoundedEvidenceInto (Vertical Slice v16 trust shell)", () => {
  it("wraps bounded evidence in a trust root with test id", () => {
    const m = createInitialLiveSessionModelState("s-ev");
    m.eventTail = [{ kind: "process_poll_sample", seq: 1 }];
    const scene = compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
    const spec = liveVisualSpecFromScene(scene, null, { previousScene: null });
    const cmp = computeBoundedSceneCompare(null, scene, { selectedId: null });
    const drill = computeBoundedEvidenceDrilldown({
      scene,
      spec,
      compare: cmp,
      selectedSelectionId: null,
      previousBoundedSampleCount: null,
      liveEventTail: m.eventTail,
    });
    const root = document.createElement("div");
    renderBoundedEvidenceInto(root, drill);
    expect(root.querySelector('[data-testid="glass-bounded-evidence-trust"]')).toBeTruthy();
  });

  it("marks claim-supporting rows with dataset and human caption", () => {
    const m = createInitialLiveSessionModelState("s-ev");
    m.eventTail = [
      { kind: "process_poll_sample", seq: 1 },
      { kind: "process_poll_sample", seq: 2 },
    ];
    const scene = compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
    const spec = liveVisualSpecFromScene(scene, null, { previousScene: null });
    const cmp = computeBoundedSceneCompare(null, scene, { selectedId: null });
    const drill = computeBoundedEvidenceDrilldown({
      scene,
      spec,
      compare: cmp,
      selectedSelectionId: null,
      previousBoundedSampleCount: null,
      liveEventTail: m.eventTail,
    });
    const root = document.createElement("div");
    renderBoundedEvidenceInto(root, drill, {
      scene,
      selectedSelectionId: null,
      liveEventTail: m.eventTail,
      replayEvents: null,
      liveVisualSpec: spec,
      supportingEvidenceRowIndices: [0],
    });
    const card = root.querySelector('[data-claim-support="true"]');
    expect(card).toBeTruthy();
    expect(root.textContent).toContain("Live tail sample");
  });
});

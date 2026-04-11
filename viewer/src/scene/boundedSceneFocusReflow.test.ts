import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import { computeBoundedSceneFocus } from "./boundedSceneFocus.js";
import { boundedSelectionIdCluster, boundedSelectionIdRegion } from "./boundedSceneSelection.js";
import {
  computeBoundedStripLayoutFromFocus,
  defaultBoundedStripLayout,
  formatBoundedStripReflowSummary,
} from "./boundedSceneFocusReflow.js";

describe("defaultBoundedStripLayout", () => {
  it("stacks primary → system → cluster without gaps", () => {
    const d = defaultBoundedStripLayout();
    expect(d.primaryY + d.primaryH + d.gapPrimarySystem).toBe(d.systemY);
    expect(d.systemY + d.systemH + d.gapSystemCluster).toBe(d.clusterY);
  });
});

describe("computeBoundedStripLayoutFromFocus", () => {
  it("matches idle strip when no selection", () => {
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("s"),
      lastReconcile: null,
    });
    const focus = computeBoundedSceneFocus(scene, null);
    const strip = computeBoundedStripLayoutFromFocus(scene, focus, null);
    expect(strip.reflowActive).toBe(false);
    expect(strip.clusterLaneFractions).toBeNull();
    expect(strip.stateRailLaneFractions).toBeNull();
  });

  it("expands cluster strip and weights lanes when a cluster is focused", () => {
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("s"),
      lastReconcile: null,
    });
    const cl = scene.clusters[0];
    expect(cl).toBeTruthy();
    if (!cl) {
      return;
    }
    const sel = boundedSelectionIdCluster(cl.id);
    const focus = computeBoundedSceneFocus(scene, sel);
    const strip = computeBoundedStripLayoutFromFocus(scene, focus, sel);
    const idle = defaultBoundedStripLayout();
    expect(strip.reflowActive).toBe(true);
    expect(strip.clusterH).toBeGreaterThan(idle.clusterH);
    if (scene.clusters.length > 1) {
      expect(strip.clusterLaneFractions?.length).toBe(scene.clusters.length);
      expect(formatBoundedStripReflowSummary(strip)).toContain("weighted cluster widths");
    } else {
      expect(strip.clusterLaneFractions).toBeNull();
    }
    const summary = formatBoundedStripReflowSummary(strip);
    expect(summary).toBeTruthy();
  });

  it("expands primary band when a primary region is focused", () => {
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("s"),
      lastReconcile: null,
    });
    const rid = scene.regions.find((r) => r.role === "primary_wire_sample")?.id;
    expect(rid).toBeTruthy();
    if (!rid) {
      return;
    }
    const sel = boundedSelectionIdRegion(rid);
    const strip = computeBoundedStripLayoutFromFocus(scene, computeBoundedSceneFocus(scene, sel), sel);
    expect(strip.primaryH).toBeGreaterThan(defaultBoundedStripLayout().primaryH);
  });
});

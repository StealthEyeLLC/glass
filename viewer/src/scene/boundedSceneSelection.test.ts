import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import { sceneToDrawablePrimitives } from "./sceneToDrawablePrimitives.js";
import { liveVisualSpecFromScene } from "./sceneToLiveVisualSpec.js";
import {
  BOUNDED_SELECTION_ID_PREFIX,
  boundedSelectionIdCluster,
  boundedSelectionIdRegion,
  buildBoundedInspectorLines,
  buildBoundedSelectionHitTargetsForScene,
  buildBoundedSelectionHitTargetsFromPrimitives,
  hitTestBoundedSelection,
  unionBoundingRectForSelectionId,
} from "./boundedSceneSelection.js";

describe("bounded scene selection ids", () => {
  it("uses stable deterministic prefixes", () => {
    expect(BOUNDED_SELECTION_ID_PREFIX).toBe("glass.sel.v0");
    expect(boundedSelectionIdCluster("cl_system")).toBe("glass.sel.v0:cluster:cl_system");
    expect(boundedSelectionIdRegion("reg_primary_wire")).toBe("glass.sel.v0:region:reg_primary_wire");
  });
});

describe("hit targets + hitTest", () => {
  it("maps density band and hitTest returns topmost id at center", () => {
    const model = createInitialLiveSessionModelState("sid");
    const scene = compileLiveToGlassSceneV0({ model, lastReconcile: null });
    const primitives = sceneToDrawablePrimitives(scene);
    const targets = buildBoundedSelectionHitTargetsFromPrimitives(scene, primitives);
    const density = targets.find((t) => t.id.includes(":wire:density_band"));
    expect(density).toBeTruthy();
    if (!density) {
      return;
    }
    const cx = density.x + density.width / 2;
    const cy = density.y + density.height / 2;
    const full = buildBoundedSelectionHitTargetsForScene(scene);
    const hit = hitTestBoundedSelection(cx, cy, full);
    expect(hit).toBeTruthy();
  });

  it("returns null for points outside the canvas", () => {
    const model = createInitialLiveSessionModelState("sid");
    const scene = compileLiveToGlassSceneV0({ model, lastReconcile: null });
    const targets = buildBoundedSelectionHitTargetsForScene(scene);
    expect(hitTestBoundedSelection(5000, 5000, targets)).toBeNull();
  });

  it("unionBoundingRectForSelectionId merges same ids", () => {
    const targets = [
      { id: "a", x: 0, y: 0, width: 10, height: 10 },
      { id: "a", x: 10, y: 0, width: 10, height: 10 },
    ];
    const u = unionBoundingRectForSelectionId("a", targets);
    expect(u).toEqual({ x: 0, y: 0, width: 20, height: 10 });
  });
});

describe("bounded inspector lines", () => {
  it("shows empty state when nothing selected", () => {
    const model = createInitialLiveSessionModelState("sid");
    const scene = compileLiveToGlassSceneV0({ model, lastReconcile: null });
    const spec = liveVisualSpecFromScene(scene);
    const lines = buildBoundedInspectorLines(scene, spec, null);
    expect(lines[0]).toContain("none");
  });

  it("describes region selection when region id present", () => {
    const model = createInitialLiveSessionModelState("sid");
    const scene = compileLiveToGlassSceneV0({ model, lastReconcile: null });
    const rid = scene.regions.find((r) => r.role === "primary_wire_sample")?.id;
    expect(rid).toBeTruthy();
    if (!rid) {
      return;
    }
    const sel = boundedSelectionIdRegion(rid);
    const spec = liveVisualSpecFromScene(scene, sel);
    const lines = buildBoundedInspectorLines(scene, spec, sel);
    expect(lines.join("\n")).toContain("Region:");
    expect(lines.join("\n")).toContain("Strip reflow (spatial):");
  });

  it("describes cluster selection", () => {
    const model = createInitialLiveSessionModelState("sid");
    const scene = compileLiveToGlassSceneV0({ model, lastReconcile: null });
    const first = scene.clusters[0];
    if (!first) {
      return;
    }
    const sel = boundedSelectionIdCluster(first.id);
    const spec = liveVisualSpecFromScene(scene, sel);
    const lines = buildBoundedInspectorLines(scene, spec, sel);
    expect(lines.join("\n")).toContain("Cluster lane:");
    expect(lines.join("\n")).toContain("Strip reflow (spatial):");
  });
});

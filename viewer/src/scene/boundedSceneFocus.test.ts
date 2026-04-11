import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import { boundedSelectionIdRegion } from "./boundedSceneSelection.js";
import {
  BOUNDED_FOCUS_MODEL_KIND,
  computeBoundedSceneFocus,
  dimHexColor,
} from "./boundedSceneFocus.js";

describe("dimHexColor", () => {
  it("returns input when hex is not 6-digit", () => {
    expect(dimHexColor("#abc", 0.5)).toBe("#abc");
  });

  it("deterministically blends toward slate", () => {
    expect(dimHexColor("#ff0000", 0)).toBe("#ff0000");
    const dimmed = dimHexColor("#ff0000", 0.5);
    expect(dimmed).toMatch(/^#[0-9a-f]{6}$/);
    expect(dimmed).not.toBe("#ff0000");
  });
});

describe("computeBoundedSceneFocus", () => {
  it("is inactive when selection is null or empty", () => {
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("sid"),
      lastReconcile: null,
    });
    const a = computeBoundedSceneFocus(scene, null);
    const b = computeBoundedSceneFocus(scene, "");
    expect(a).toEqual(b);
    expect(a.kind).toBe(BOUNDED_FOCUS_MODEL_KIND);
    expect(a.active).toBe(false);
    expect(a.selectionId).toBeNull();
    expect(a.captionLine).toBeNull();
    expect(a.provenanceFocusLine).toBeNull();
    expect(a.dimPrimaryWire).toBe(false);
  });

  it("maps a known region id to primary_wire band and related regions", () => {
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("sid"),
      lastReconcile: null,
    });
    const reg = scene.regions.find((r) => r.role === "primary_wire_sample");
    expect(reg).toBeTruthy();
    if (!reg) {
      return;
    }
    const f = computeBoundedSceneFocus(scene, boundedSelectionIdRegion(reg.id));
    expect(f.active).toBe(true);
    expect(f.emphasizedVerticalBand).toBe("primary_wire");
    expect(f.focusedRegionId).toBe(reg.id);
    expect(f.dimPrimaryWire).toBe(false);
    expect(f.dimSystemRail).toBe(true);
    expect(f.dimEvidenceStrip).toBe(true);
    expect(f.relatedRegionIds).toContain(reg.id);
    expect(f.captionLine).toContain("region");
    expect(f.provenanceFocusLine).toContain("focus=primary_wire");
  });
});

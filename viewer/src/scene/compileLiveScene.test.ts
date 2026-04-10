import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import { GLASS_SCENE_V0 } from "./glassSceneV0.js";
import { liveVisualSpecFromScene } from "./sceneToLiveVisualSpec.js";

describe("compileLiveToGlassSceneV0", () => {
  it("matches liveVisualSpecFromScene round-trip with prior semantics", () => {
    const model = createInitialLiveSessionModelState("sid");
    const scene = compileLiveToGlassSceneV0({ model, lastReconcile: null });
    expect(scene.kind).toBe(GLASS_SCENE_V0);
    expect(scene.source).toBe("live");
    const spec = liveVisualSpecFromScene(scene);
    expect(spec.mode).toBe("idle");
    expect(spec.sessionId).toBe("sid");
    expect(spec.honestyLine).toContain("not topology");
    expect(scene.zones[0]?.label.toLowerCase()).toContain("wire");
  });

  it("passes httpSnapshotOrigin into snapshotOriginLabel when model has no replace yet", () => {
    const model = createInitialLiveSessionModelState("sid");
    const scene = compileLiveToGlassSceneV0({
      model,
      lastReconcile: null,
      httpSnapshotOrigin: "from_http_only",
    });
    expect(scene.snapshotOriginLabel).toBe("from_http_only");
  });
});

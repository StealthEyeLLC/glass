import { describe, expect, it } from "vitest";
import { GLASS_SCENE_V0 } from "./glassSceneV0.js";

describe("Glass Scene v0 model", () => {
  it("uses stable kind string", () => {
    expect(GLASS_SCENE_V0).toBe("glass.scene.v0");
  });
});

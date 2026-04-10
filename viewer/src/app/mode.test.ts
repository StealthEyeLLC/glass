import { describe, expect, it } from "vitest";
import { getBuildMode, uiSurfaceFromSearch } from "./mode.js";

describe("getBuildMode", () => {
  it("remains static_replay for Tier B", () => {
    expect(getBuildMode()).toBe("static_replay");
  });
});

describe("uiSurfaceFromSearch", () => {
  it("defaults to replay", () => {
    expect(uiSurfaceFromSearch("")).toBe("replay");
    expect(uiSurfaceFromSearch("?x=1")).toBe("replay");
  });

  it("selects live_session with live=1", () => {
    expect(uiSurfaceFromSearch("?live=1")).toBe("live_session");
  });
});

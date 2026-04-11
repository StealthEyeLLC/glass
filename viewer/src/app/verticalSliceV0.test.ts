import { describe, expect, it } from "vitest";
import {
  VERTICAL_SLICE_FLAGSHIP_V18_SESSION_ID,
  VERTICAL_SLICE_SCENARIO_LABEL,
  VERTICAL_SLICE_SCENARIO_TITLE,
  VERTICAL_SLICE_V0_ID,
  liveHeroSubtitle,
  replayHeroSubtitle,
} from "./verticalSliceV0.js";

describe("verticalSliceV0", () => {
  it("exports stable slice id and demo copy", () => {
    expect(VERTICAL_SLICE_V0_ID).toBe("glass.vertical_slice.v0");
    expect(VERTICAL_SLICE_SCENARIO_TITLE.length).toBeGreaterThan(4);
    expect(VERTICAL_SLICE_SCENARIO_LABEL.length).toBeGreaterThan(4);
    expect(replayHeroSubtitle()).toContain("static replay");
    expect(replayHeroSubtitle()).toContain("flagship");
    expect(liveHeroSubtitle()).toContain("Same strip");
    expect(VERTICAL_SLICE_FLAGSHIP_V18_SESSION_ID).toBe("canonical_v15_append_heavy");
  });
});

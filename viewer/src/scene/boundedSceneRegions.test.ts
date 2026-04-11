import { describe, expect, it } from "vitest";
import {
  buildLiveBoundedRegions,
  buildReplayBoundedRegions,
  formatBoundedCompositionCaption,
} from "./boundedSceneRegions.js";

describe("boundedSceneRegions", () => {
  it("live regions reference existing zone ids only (grouping, not edges)", () => {
    const r = buildLiveBoundedRegions();
    expect(r).toHaveLength(3);
    expect(r.flatMap((x) => [...x.memberZoneIds])).toEqual(
      expect.arrayContaining(["z_wire", "z_state_rail", "z_actor"]),
    );
    expect(formatBoundedCompositionCaption(r)).toBe("Wire · System · Evidence");
  });

  it("replay regions use replay zone ids", () => {
    const r = buildReplayBoundedRegions();
    expect(r).toHaveLength(3);
    expect(r[0]?.memberZoneIds).toContain("z_primary");
    expect(r[1]?.memberZoneIds).toContain("z_state_rail");
    expect(r[2]?.memberZoneIds).toEqual(["z_actor"]);
    expect(formatBoundedCompositionCaption(r)).toBe("Wire · System · Evidence");
  });
});

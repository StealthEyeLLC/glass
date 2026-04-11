import { describe, expect, it } from "vitest";
import {
  GLASS_FLAGSHIP_CHAIN_DOC,
  GLASS_FLAGSHIP_CHAIN_ONE_LINER,
  RECEIPT_EMPTY_SUPPLEMENT_AFTER_TEMPORAL_BASELINE,
  VERTICAL_SLICE_FLAGSHIP_V18_SESSION_ID,
  VERTICAL_SLICE_SCENARIO_LABEL,
  VERTICAL_SLICE_SCENARIO_TITLE,
  VERTICAL_SLICE_V20_READING_ORDER_LIVE,
  VERTICAL_SLICE_V20_READING_ORDER_REPLAY,
  VERTICAL_SLICE_V0_ID,
  liveHeroSubtitle,
  replayHeroSubtitle,
  replayHeroSubtitleTechnical,
} from "./verticalSliceV0.js";

describe("verticalSliceV0", () => {
  it("exports stable slice id and demo copy", () => {
    expect(VERTICAL_SLICE_V0_ID).toBe("glass.vertical_slice.v0");
    expect(VERTICAL_SLICE_SCENARIO_TITLE.length).toBeGreaterThan(4);
    expect(VERTICAL_SLICE_SCENARIO_LABEL.length).toBeGreaterThan(4);
    expect(replayHeroSubtitle()).toContain("static replay");
    expect(replayHeroSubtitle()).toContain("flagship");
    expect(replayHeroSubtitleTechnical()).toContain("vertical_slice_v0");
    expect(replayHeroSubtitleTechnical()).toContain("?fixture=flagship");
    expect(liveHeroSubtitle()).toContain("Same strip");
    expect(VERTICAL_SLICE_FLAGSHIP_V18_SESSION_ID).toBe("canonical_v15_append_heavy");
    expect(VERTICAL_SLICE_V20_READING_ORDER_REPLAY).toContain("temporal lens");
    expect(VERTICAL_SLICE_V20_READING_ORDER_REPLAY).toContain(GLASS_FLAGSHIP_CHAIN_ONE_LINER);
    expect(VERTICAL_SLICE_V20_READING_ORDER_LIVE).toContain("WS tail");
    expect(VERTICAL_SLICE_V20_READING_ORDER_LIVE).toContain(GLASS_FLAGSHIP_CHAIN_ONE_LINER);
    expect(GLASS_FLAGSHIP_CHAIN_DOC.length).toBeGreaterThan(40);
    expect(RECEIPT_EMPTY_SUPPLEMENT_AFTER_TEMPORAL_BASELINE.length).toBeGreaterThan(20);
  });
});

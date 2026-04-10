/**
 * Known-good Vertical Slice v0 `.glass_pack` fixture (committed under tests/fixtures/).
 * @vitest-environment node
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { loadGlassPack } from "../pack/loadPack.js";
import { compileReplayToGlassSceneV0 } from "../scene/compileReplayScene.js";
import { GLASS_SCENE_V0 } from "../scene/glassSceneV0.js";
import {
  initialReplayState,
  reduceReplay,
} from "./replayModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Must stay aligned with `viewer/scripts/writeVerticalSliceFixture.mjs` + docs. */
const VERTICAL_SLICE_V0_FIXTURE_SESSION_ID = "glass_vertical_slice_v0";

function fixturePackBytes(): Uint8Array {
  const p = join(
    __dirname,
    "..",
    "..",
    "..",
    "tests",
    "fixtures",
    "vertical_slice_v0",
    "glass_vertical_slice_v0_tier_b.glass_pack",
  );
  return new Uint8Array(readFileSync(p));
}

describe("Vertical Slice v0 fixture pack (integration)", () => {
  it("loads under strict_kinds and compiles to honest bounded Scene v0", () => {
    const bytes = fixturePackBytes();
    const r = loadGlassPack(bytes, "strict_kinds");
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.manifest.session_id).toBe(VERTICAL_SLICE_V0_FIXTURE_SESSION_ID);
    expect(r.events.length).toBeGreaterThanOrEqual(3);

    let st = initialReplayState();
    st = reduceReplay(st, {
      type: "load_ok",
      fileName: "glass_vertical_slice_v0_tier_b.glass_pack",
      manifest: r.manifest,
      events: r.events,
    });
    expect(st.loadStatus).toBe("ready");

    const sceneAtStart = compileReplayToGlassSceneV0(st);
    expect(sceneAtStart.kind).toBe(GLASS_SCENE_V0);
    expect(sceneAtStart.source).toBe("replay");
    expect(sceneAtStart.honesty.line.toLowerCase()).toContain("not live tail");
    expect(sceneAtStart.honesty.line.toLowerCase()).toContain("not process topology");
    expect(sceneAtStart.honesty.sampleScope).toBe("replay_index_prefix");
    expect(sceneAtStart.boundedSampleCount).toBe(1);
    expect(sceneAtStart.wireMode).toBe("replace");

    st = reduceReplay(st, { type: "seek_index", index: 2 });
    const sceneEnd = compileReplayToGlassSceneV0(st);
    expect(sceneEnd.boundedSampleCount).toBe(3);
    expect(sceneEnd.wireMode).toBe("append");
    expect(sceneEnd.honesty.sampleScope).toBe("replay_index_prefix");
    expect(sceneEnd.totalEventCardinality).toBe(3);
  });
});

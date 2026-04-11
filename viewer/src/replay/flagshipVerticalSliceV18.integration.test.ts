/**
 * Vertical Slice v18 — flagship bounded scenario (canonical append-heavy).
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
  VERTICAL_SLICE_FLAGSHIP_V18_PACK_FILE,
  VERTICAL_SLICE_FLAGSHIP_V18_SESSION_ID,
} from "../app/verticalSliceV0.js";
import { initialReplayState, reduceReplay } from "./replayModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadFlagshipBytes(): Uint8Array {
  const p = join(
    __dirname,
    "..",
    "..",
    "..",
    "tests",
    "fixtures",
    "canonical_scenarios_v15",
    VERTICAL_SLICE_FLAGSHIP_V18_PACK_FILE,
  );
  return new Uint8Array(readFileSync(p));
}

describe("Vertical Slice v18 — flagship bounded scenario (append-heavy)", () => {
  it("loads strict_kinds, session id, and tail depth for bounded compare/evidence", () => {
    const bytes = loadFlagshipBytes();
    const r = loadGlassPack(bytes, "strict_kinds");
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.manifest.session_id).toBe(VERTICAL_SLICE_FLAGSHIP_V18_SESSION_ID);
    expect(r.events.length).toBe(14);
    let st = initialReplayState();
    st = reduceReplay(st, {
      type: "load_ok",
      fileName: VERTICAL_SLICE_FLAGSHIP_V18_PACK_FILE,
      manifest: r.manifest,
      events: r.events,
    });
    st = reduceReplay(st, { type: "seek_index", index: r.events.length - 1 });
    const scene = compileReplayToGlassSceneV0(st);
    expect(scene.kind).toBe(GLASS_SCENE_V0);
    expect(scene.boundedSampleCount).toBe(14);
    expect(scene.wireMode).toBe("append");
  });
});

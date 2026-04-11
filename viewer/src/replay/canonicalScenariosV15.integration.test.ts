/**
 * Vertical Slice v15 — canonical bounded scenario suite (replay packs + live resync/warning harness).
 * @vitest-environment node
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import { applyLiveSessionLine, createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { loadGlassPack } from "../pack/loadPack.js";
import { compileLiveToGlassSceneV0 } from "../scene/compileLiveScene.js";
import { computeBoundedSceneCompare } from "../scene/boundedSceneCompare.js";
import { compileReplayToGlassSceneV0 } from "../scene/compileReplayScene.js";
import { GLASS_SCENE_V0 } from "../scene/glassSceneV0.js";
import { initialReplayState, reduceReplay } from "./replayModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function repoRelativeFixture(...segments: string[]): Uint8Array {
  const p = join(__dirname, "..", "..", "..", "tests", "fixtures", ...segments);
  return new Uint8Array(readFileSync(p));
}

function loadScenarioPack(fileName: string) {
  const bytes = repoRelativeFixture("canonical_scenarios_v15", fileName);
  const r = loadGlassPack(bytes, "strict_kinds");
  expect(r.ok).toBe(true);
  if (!r.ok) {
    throw new Error("load failed");
  }
  let st = initialReplayState();
  st = reduceReplay(st, {
    type: "load_ok",
    fileName,
    manifest: r.manifest,
    events: r.events,
  });
  expect(st.loadStatus).toBe("ready");
  return { st, manifest: r.manifest, events: r.events };
}

describe("Vertical Slice v15 — replace-heavy (replay)", () => {
  it("replace wire mode at cursor 0; append after stepping", () => {
    const { st: s0, manifest } = loadScenarioPack("canonical_v15_replace_heavy.glass_pack");
    expect(manifest.session_id).toBe("canonical_v15_replace_heavy");

    let st = s0;
    st = reduceReplay(st, { type: "seek_index", index: 0 });
    const atStart = compileReplayToGlassSceneV0(st);
    expect(atStart.kind).toBe(GLASS_SCENE_V0);
    expect(atStart.wireMode).toBe("replace");
    expect(atStart.boundedSampleCount).toBe(1);

    st = reduceReplay(st, { type: "seek_index", index: 3 });
    const mid = compileReplayToGlassSceneV0(st);
    expect(mid.wireMode).toBe("append");
    expect(mid.boundedSampleCount).toBe(4);
  });
});

describe("Vertical Slice v15 — append-heavy (replay)", () => {
  it("append wire mode at last index; prefix covers full pack", () => {
    const { st: s0, events } = loadScenarioPack("canonical_v15_append_heavy.glass_pack");
    expect(events.length).toBe(14);
    const last = events.length - 1;
    let st = s0;
    st = reduceReplay(st, { type: "seek_index", index: last });
    const scene = compileReplayToGlassSceneV0(st);
    expect(scene.wireMode).toBe("append");
    expect(scene.boundedSampleCount).toBe(14);
    expect(scene.replayPrefixFraction).toBe(1);
  });
});

describe("Vertical Slice v15 — calm / steady-state (replay compare)", () => {
  it("bounded compare reports unchanged when prior equals current", () => {
    const { st: s0 } = loadScenarioPack("canonical_v15_calm_steady.glass_pack");
    let st = s0;
    st = reduceReplay(st, { type: "seek_index", index: 2 });
    const scene = compileReplayToGlassSceneV0(st);
    const cmp = computeBoundedSceneCompare(scene, scene, { selectedId: null });
    expect(cmp.available).toBe(true);
    expect(cmp.summaryLine).toContain("unchanged");
  });
});

describe("Vertical Slice v15 — file-heavy (replay clusters)", () => {
  it("file_poll_snapshot prefix yields file cluster lane", () => {
    const { st: s0, events } = loadScenarioPack("canonical_v15_file_heavy.glass_pack");
    expect(events.every((e) => e.kind === "file_poll_snapshot")).toBe(true);
    let st = s0;
    st = reduceReplay(st, { type: "seek_index", index: events.length - 1 });
    const scene = compileReplayToGlassSceneV0(st);
    const lanes = scene.clusters.map((c) => c.lane);
    expect(lanes).toContain("file_samples");
    expect(scene.clusters.some((c) => c.id === "cl_file")).toBe(true);
  });
});

describe("Vertical Slice v15 — resync / warning (live model, no extra pack)", () => {
  it("session_warning surfaces warningCode on GlassSceneV0", () => {
    let model = createInitialLiveSessionModelState("canonical_v15_live");
    model = applyLiveSessionLine(
      model,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_warning",
        protocol: 1,
        code: "canonical_v15_test_warn",
        detail: "synthetic bounded warning for scenario suite",
      }),
    );
    const scene = compileLiveToGlassSceneV0({ model, lastReconcile: null });
    expect(scene.source).toBe("live");
    expect(scene.warningCode).toBe("canonical_v15_test_warn");
    expect(scene.wireMode).toBe("warning");
  });

  it("session_resync_required surfaces resyncReason on GlassSceneV0", () => {
    let model = createInitialLiveSessionModelState("canonical_v15_live_resync");
    model = applyLiveSessionLine(
      model,
      JSON.stringify({
        type: "glass.bridge.live_session.v1",
        msg: "session_resync_required",
        protocol: 1,
        reason: "canonical_v15_test_resync_reason",
        action: "use_http_snapshot",
      }),
    );
    const scene = compileLiveToGlassSceneV0({ model, lastReconcile: null });
    expect(scene.wireMode).toBe("resync");
    expect(scene.resyncReason).toContain("canonical_v15_test_resync");
  });
});

describe("Vertical Slice v15 — regression: original vertical slice v0 fixture", () => {
  it("still loads and compiles (flagship path unchanged)", () => {
    const bytes = repoRelativeFixture("vertical_slice_v0", "glass_vertical_slice_v0_tier_b.glass_pack");
    const r = loadGlassPack(bytes, "strict_kinds");
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    let st = initialReplayState();
    st = reduceReplay(st, {
      type: "load_ok",
      fileName: "glass_vertical_slice_v0_tier_b.glass_pack",
      manifest: r.manifest,
      events: r.events,
    });
    const scene = compileReplayToGlassSceneV0(st);
    expect(scene.kind).toBe(GLASS_SCENE_V0);
    expect(scene.honesty.sampleScope).toBe("replay_index_prefix");
  });
});

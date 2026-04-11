import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import {
  CANONICAL_EVENT_SCHEMA_VERSION,
  PACK_FORMAT_SCAFFOLD_V0,
} from "../pack/types.js";
import type { GlassEvent, GlassManifest } from "../pack/types.js";
import { initialReplayState, reduceReplay } from "../replay/replayModel.js";
import { computeBoundedSceneCompare } from "./boundedSceneCompare.js";
import type { BoundedEpisodeV0 } from "./boundedEpisodes.js";
import {
  boundedEpisodeEvidenceUiLines,
  boundedEpisodeSelectionStillValid,
  computeBoundedSceneEpisodes,
} from "./boundedEpisodes.js";
import { renderBoundedEpisodesInto } from "./boundedEpisodesPanel.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import { compileReplayToGlassSceneV0 } from "./compileReplayScene.js";

function sceneFromTail(len: number) {
  const m = createInitialLiveSessionModelState("s-ep");
  m.eventTail = Array.from({ length: len }, (_, i) => ({
    kind: "process_poll_sample",
    seq: i + 1,
  }));
  return compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
}

function manifest(): GlassManifest {
  return {
    pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
    session_id: "s1",
    capture_mode: "replay",
    sanitized: false,
    human_readable_redaction_summary: [],
    share_safe_recommended: false,
  };
}

function ev(seq: number): GlassEvent {
  return {
    schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
    event_id: `e${seq}`,
    session_id: "s1",
    ts_ns: seq,
    seq,
    kind: "process_poll_sample",
    actor: { entity_type: "process", entity_id: "p1" },
    attrs: {},
    source: {
      adapter: "t",
      quality: "direct",
      time_domain: "session_monotonic",
    },
  };
}

describe("computeBoundedSceneEpisodes", () => {
  it("returns insufficient_history when compare has no baseline", () => {
    const cur = sceneFromTail(1);
    const cmp = computeBoundedSceneCompare(null, cur, { selectedId: null });
    const out = computeBoundedSceneEpisodes({
      path: "live",
      currentScene: cur,
      baselineScene: null,
      immediatePriorScene: null,
      compare: cmp,
      selectedSelectionId: null,
      liveEventTailMutation: null,
      compareBaselineIsImmediatePrior: true,
    });
    expect(out.episodes).toHaveLength(1);
    expect(out.episodes[0]?.kind).toBe("insufficient_history");
  });

  it("emits settle when bounded compare is unchanged", () => {
    const a = sceneFromTail(3);
    const b = sceneFromTail(3);
    const cmp = computeBoundedSceneCompare(a, b, { selectedId: null });
    const out = computeBoundedSceneEpisodes({
      path: "live",
      currentScene: b,
      baselineScene: a,
      immediatePriorScene: a,
      compare: cmp,
      selectedSelectionId: null,
      liveEventTailMutation: "none",
      compareBaselineIsImmediatePrior: true,
    });
    expect(out.episodes.some((e) => e.kind === "settle")).toBe(true);
  });

  it("live: surfaces tail growth as append-style episode", () => {
    const prev = sceneFromTail(2);
    const cur = sceneFromTail(5);
    const cmp = computeBoundedSceneCompare(prev, cur, { selectedId: null });
    const out = computeBoundedSceneEpisodes({
      path: "live",
      currentScene: cur,
      baselineScene: prev,
      immediatePriorScene: prev,
      compare: cmp,
      selectedSelectionId: null,
      liveEventTailMutation: "append",
      compareBaselineIsImmediatePrior: true,
    });
    expect(out.episodes.some((e) => e.kind === "tail_append")).toBe(true);
  });

  it("replay: replay_cursor_step when immediate prior cursor differs", () => {
    let st = initialReplayState();
    st = reduceReplay(st, {
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: manifest(),
      events: [ev(1), ev(2), ev(3)],
    });
    st = reduceReplay(st, { type: "seek_index", index: 0 });
    const priorScene = compileReplayToGlassSceneV0(st);
    st = reduceReplay(st, { type: "seek_index", index: 1 });
    const curScene = compileReplayToGlassSceneV0(st);
    const cmp = computeBoundedSceneCompare(priorScene, curScene, { selectedId: null });
    expect(cmp.available).toBe(true);
    const out = computeBoundedSceneEpisodes({
      path: "replay",
      currentScene: curScene,
      baselineScene: priorScene,
      immediatePriorScene: priorScene,
      compare: cmp,
      selectedSelectionId: null,
      liveEventTailMutation: null,
      compareBaselineIsImmediatePrior: true,
    });
    expect(out.episodes.some((e) => e.kind === "replay_cursor_step")).toBe(true);
  });

  it("replay: notes baseline vs immediate prior when compare baseline is not immediate prior", () => {
    let st = initialReplayState();
    st = reduceReplay(st, {
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: manifest(),
      events: [ev(1), ev(2), ev(3)],
    });
    st = reduceReplay(st, { type: "seek_index", index: 0 });
    const baseline = compileReplayToGlassSceneV0(st);
    st = reduceReplay(st, { type: "seek_index", index: 1 });
    const immediatePrior = compileReplayToGlassSceneV0(st);
    st = reduceReplay(st, { type: "seek_index", index: 2 });
    const cur = compileReplayToGlassSceneV0(st);
    const cmp = computeBoundedSceneCompare(baseline, cur, { selectedId: null });
    const out = computeBoundedSceneEpisodes({
      path: "replay",
      currentScene: cur,
      baselineScene: baseline,
      immediatePriorScene: immediatePrior,
      compare: cmp,
      selectedSelectionId: null,
      liveEventTailMutation: null,
      compareBaselineIsImmediatePrior: false,
    });
    const step = out.episodes.find((e) => e.kind === "replay_cursor_step");
    expect(step?.honestyNote).toMatch(/Compare baseline may differ/);
  });
});

describe("boundedEpisodeSelectionStillValid", () => {
  it("treats null as always valid", () => {
    expect(boundedEpisodeSelectionStillValid([], null)).toBe(true);
  });

  it("returns false when id missing", () => {
    expect(boundedEpisodeSelectionStillValid([], "ep-v12:settle:0")).toBe(false);
  });
});

describe("boundedEpisodeEvidenceUiLines", () => {
  it("returns generic honesty when episode has no suggested target and no episode honesty line", () => {
    const fake: BoundedEpisodeV0[] = [
      {
        id: "ep-test",
        kind: "settle",
        title: "T",
        summary: "S",
        honestyNote: null,
        suggestedSelectionId: null,
        compareHookLine: null,
        isPrimary: true,
      },
    ];
    const r = boundedEpisodeEvidenceUiLines(fake, "ep-test");
    expect(r.contextLine).toContain("T");
    expect(r.honestyNote).toMatch(/No additional scene selection/);
  });
});

describe("renderBoundedEpisodesInto", () => {
  it("renders cards with data-testid prefix", () => {
    const root = document.createElement("div");
    const cur = sceneFromTail(3);
    const cmp = computeBoundedSceneCompare(cur, cur, { selectedId: null });
    const pack = computeBoundedSceneEpisodes({
      path: "live",
      currentScene: cur,
      baselineScene: cur,
      immediatePriorScene: cur,
      compare: cmp,
      selectedSelectionId: null,
      liveEventTailMutation: null,
      compareBaselineIsImmediatePrior: true,
    });
    renderBoundedEpisodesInto(root, pack, {
      testIdPrefix: "replay",
      selectedEpisodeId: null,
      onSelectEpisode: () => {},
    });
    expect(root.querySelector('[data-testid="replay-bounded-episodes-row"]')).toBeTruthy();
    expect(root.querySelectorAll('[data-testid="replay-bounded-episode-card"]').length).toBeGreaterThan(
      0,
    );
  });
});

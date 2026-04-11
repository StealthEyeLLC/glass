import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import {
  CANONICAL_EVENT_SCHEMA_VERSION,
  PACK_FORMAT_SCAFFOLD_V0,
} from "../pack/types.js";
import type { GlassEvent, GlassManifest } from "../pack/types.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import { compileReplayToGlassSceneV0 } from "./compileReplayScene.js";
import { computeBoundedSceneCompare } from "./boundedSceneCompare.js";
import { computeBoundedEvidenceDrilldown } from "./boundedEvidenceDrilldown.js";
import { liveVisualSpecFromScene } from "./sceneToLiveVisualSpec.js";
import { initialReplayState, reduceReplay } from "../replay/replayModel.js";

function liveSceneFromTail(len: number) {
  const m = createInitialLiveSessionModelState("s-ev");
  m.eventTail = Array.from({ length: len }, (_, i) => ({
    kind: "process_poll_sample",
    seq: i + 1,
  }));
  return compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
}

function replayManifest(): GlassManifest {
  return {
    pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
    session_id: "s1",
    capture_mode: "replay",
    sanitized: false,
    human_readable_redaction_summary: [],
    share_safe_recommended: false,
  };
}

function replayEv(seq: number, kind: string = "process_poll_sample"): GlassEvent {
  return {
    schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
    event_id: `e${seq}`,
    session_id: "s1",
    ts_ns: seq,
    seq,
    kind,
    actor: { entity_type: "process", entity_id: "p1" },
    attrs: {},
    source: {
      adapter: "t",
      quality: "direct",
      time_domain: "session_monotonic",
    },
  };
}

describe("computeBoundedEvidenceDrilldown (live)", () => {
  it("shows tail rows when events present", () => {
    const m = createInitialLiveSessionModelState("s-ev");
    m.eventTail = [
      { kind: "process_poll_sample", seq: 1 },
      { kind: "process_poll_sample", seq: 2 },
    ];
    const scene = compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
    const spec = liveVisualSpecFromScene(scene, null, { previousScene: null });
    const cmp = computeBoundedSceneCompare(null, scene, { selectedId: null });
    const d = computeBoundedEvidenceDrilldown({
      scene,
      spec,
      compare: cmp,
      selectedSelectionId: null,
      previousBoundedSampleCount: null,
      liveEventTail: m.eventTail,
    });
    expect(d.rows.length).toBeGreaterThan(0);
    expect(d.rows.every((r) => r.rowLabel === "live_tail")).toBe(true);
    expect(d.rows[0]?.rowKey).toEqual({ kind: "live_tail_event", tailIndex: 0 });
    expect(d.scopeLine).toContain("WebSocket tail");
  });

  it("narrows to process cluster kinds when selected", () => {
    const m = createInitialLiveSessionModelState("s-ev");
    m.eventTail = [
      { kind: "process_poll_sample", seq: 1 },
      { kind: "file_read", seq: 2 },
    ];
    const scene = compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
    const spec = liveVisualSpecFromScene(scene, "glass.sel.v0:cluster:cl_process", {
      previousScene: null,
    });
    const cmp = computeBoundedSceneCompare(null, scene, { selectedId: "glass.sel.v0:cluster:cl_process" });
    const d = computeBoundedEvidenceDrilldown({
      scene,
      spec,
      compare: cmp,
      selectedSelectionId: "glass.sel.v0:cluster:cl_process",
      previousBoundedSampleCount: null,
      liveEventTail: m.eventTail,
    });
    expect(d.rows.length).toBe(1);
    expect(d.rows[0]?.titleLine).toContain("process_poll");
  });

  it("marks changed rows when tail grew vs prior bounded count", () => {
    const m = createInitialLiveSessionModelState("s-ev");
    m.eventTail = [
      { kind: "process_poll_sample", seq: 1 },
      { kind: "process_poll_sample", seq: 2 },
      { kind: "process_poll_sample", seq: 3 },
    ];
    const scene = compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
    const prev = liveSceneFromTail(2);
    const spec = liveVisualSpecFromScene(scene, null, { previousScene: prev });
    const cmp = computeBoundedSceneCompare(prev, scene, { selectedId: null });
    const d = computeBoundedEvidenceDrilldown({
      scene,
      spec,
      compare: cmp,
      selectedSelectionId: null,
      previousBoundedSampleCount: prev.boundedSampleCount,
      liveEventTail: m.eventTail,
    });
    const changed = d.rows.filter((r) => r.rowLabel === "changed");
    expect(changed.length).toBeGreaterThan(0);
  });
});

describe("computeBoundedEvidenceDrilldown (replay)", () => {
  it("shows prefix events with current_step on cursor", () => {
    let st = initialReplayState();
    st = reduceReplay(st, {
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: replayManifest(),
      events: [replayEv(1), replayEv(2), replayEv(3)],
    });
    st = reduceReplay(st, { type: "seek_index", index: 1 });
    const scene = compileReplayToGlassSceneV0(st);
    const spec = liveVisualSpecFromScene(scene, null, { previousScene: null });
    const cmp = computeBoundedSceneCompare(null, scene, { selectedId: null });
    const d = computeBoundedEvidenceDrilldown({
      scene,
      spec,
      compare: cmp,
      selectedSelectionId: null,
      previousBoundedSampleCount: null,
      liveEventTail: null,
      replay: { events: st.events, cursorIndex: st.cursorIndex },
    });
    expect(d.rows.some((r) => r.rowLabel === "current_step")).toBe(true);
    const cur = d.rows.find((r) => r.rowLabel === "current_step");
    expect(cur?.rowKey.kind).toBe("replay_prefix_event");
    expect(d.scopeLine).toContain("pack prefix");
  });

  it("returns no matching rows when cluster filter excludes prefix kinds", () => {
    let st = initialReplayState();
    st = reduceReplay(st, {
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: replayManifest(),
      events: [replayEv(1, "file_read"), replayEv(2, "file_read")],
    });
    const scene = compileReplayToGlassSceneV0(st);
    const spec = liveVisualSpecFromScene(scene, "glass.sel.v0:cluster:cl_process", {
      previousScene: null,
    });
    const cmp = computeBoundedSceneCompare(null, scene, {
      selectedId: "glass.sel.v0:cluster:cl_process",
    });
    const d = computeBoundedEvidenceDrilldown({
      scene,
      spec,
      compare: cmp,
      selectedSelectionId: "glass.sel.v0:cluster:cl_process",
      previousBoundedSampleCount: null,
      liveEventTail: null,
      replay: { events: st.events, cursorIndex: st.cursorIndex },
    });
    expect(d.rows.length).toBe(0);
    expect(d.facts.some((f) => f.includes("bucket"))).toBe(true);
  });
});

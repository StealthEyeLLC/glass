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
import type { LiveVisualSpec } from "../live/liveVisualModel.js";
import { boundedSelectionIdCluster, boundedSelectionIdOverlay } from "./boundedSceneSelection.js";
import {
  evidenceRowLinkedToSelection,
  honestBoundedClusterIdFromEvent,
  resolveCompareEvidenceCrosslink,
  resolveEvidenceRowKeyToSelection,
  resolveSystemIntegrityRegionSelection,
} from "./boundedSceneCrosslink.js";

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

describe("honestBoundedClusterIdFromEvent", () => {
  it("maps process kinds to cl_process", () => {
    expect(honestBoundedClusterIdFromEvent({ kind: "process_poll_sample" })).toBe("cl_process");
    expect(honestBoundedClusterIdFromEvent({ kind: "command_exec" })).toBe("cl_process");
  });

  it("maps file kinds to cl_file", () => {
    expect(honestBoundedClusterIdFromEvent({ kind: "file_read" })).toBe("cl_file");
  });

  it("returns null for unbucketed kinds", () => {
    expect(honestBoundedClusterIdFromEvent({ kind: "network_connect" })).toBe(null);
  });
});

describe("resolveEvidenceRowKeyToSelection", () => {
  it("maps live tail row to process cluster selection", () => {
    const m = createInitialLiveSessionModelState("s-x");
    m.eventTail = [{ kind: "process_poll_sample", seq: 1 }];
    const scene = compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
    const res = resolveEvidenceRowKeyToSelection(
      scene,
      { kind: "live_tail_event", tailIndex: 0 },
      { liveEventTail: m.eventTail, replayEvents: null },
    );
    expect(res.targetSelectionId).toBe(boundedSelectionIdCluster("cl_process"));
    expect(res.honestyNote).toBeNull();
  });

  it("is honest when kind does not map to a single cluster", () => {
    const m = createInitialLiveSessionModelState("s-x");
    m.eventTail = [{ kind: "network_connect", seq: 1 }];
    const scene = compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
    const res = resolveEvidenceRowKeyToSelection(
      scene,
      { kind: "live_tail_event", tailIndex: 0 },
      { liveEventTail: m.eventTail, replayEvents: null },
    );
    expect(res.targetSelectionId).toBeNull();
    expect(res.honestyNote).toContain("does not map");
  });

  it("maps replay row key to file cluster", () => {
    let st = initialReplayState();
    st = reduceReplay(st, {
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: replayManifest(),
      events: [replayEv(1, "file_read"), replayEv(2, "file_read")],
    });
    const scene = compileReplayToGlassSceneV0(st);
    const ev = st.events[0];
    if (!ev) {
      throw new Error("expected event");
    }
    const res = resolveEvidenceRowKeyToSelection(
      scene,
      { kind: "replay_prefix_event", seq: ev.seq, event_id: ev.event_id },
      { liveEventTail: null, replayEvents: st.events },
    );
    expect(res.targetSelectionId).toBe(boundedSelectionIdCluster("cl_file"));
  });

  it("resolves system integrity region when present", () => {
    const m = createInitialLiveSessionModelState("s-x");
    m.eventTail = [];
    m.lastWarning = { msg: "session_warning", code: "W1", detail: "x" };
    const scene = compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
    const res = resolveSystemIntegrityRegionSelection(scene);
    expect(res.targetSelectionId).toMatch(/^glass\.sel\.v0:region:/);
    expect(res.honestyNote).toBeNull();
  });
});

describe("resolveCompareEvidenceCrosslink", () => {
  it("prefers compare_selection overlay when selection line present", () => {
    const spec = {
      boundedCompareSelectionLine: "sel delta",
      boundedCompareSummaryLine: "summary",
      boundedCompareUnavailableReason: null,
    } as unknown as LiveVisualSpec;
    const r = resolveCompareEvidenceCrosslink(spec);
    expect(r.targetSelectionId).toBe(boundedSelectionIdOverlay("compare_selection"));
  });

  it("falls back to compare_summary", () => {
    const spec = {
      boundedCompareSelectionLine: null,
      boundedCompareSummaryLine: "tail changed",
      boundedCompareUnavailableReason: null,
    } as unknown as LiveVisualSpec;
    const r = resolveCompareEvidenceCrosslink(spec);
    expect(r.targetSelectionId).toBe(boundedSelectionIdOverlay("compare_summary"));
  });
});

describe("evidenceRowLinkedToSelection", () => {
  it("matches when ids equal", () => {
    const id = boundedSelectionIdCluster("cl_process");
    expect(
      evidenceRowLinkedToSelection({ targetSelectionId: id, honestyNote: null }, id),
    ).toBe(true);
    expect(
      evidenceRowLinkedToSelection({ targetSelectionId: id, honestyNote: null }, null),
    ).toBe(false);
  });
});

describe("drilldown row keys + selection narrowing (v10)", () => {
  it("includes live_tail_event keys on live rows", () => {
    const m = createInitialLiveSessionModelState("s-ev");
    m.eventTail = [{ kind: "process_poll_sample", seq: 1 }];
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
      replay: null,
    });
    expect(d.rows[0]?.rowKey).toEqual({ kind: "live_tail_event", tailIndex: 0 });
  });

  it("echoes selection-scoped compare into compare summary line when available", () => {
    const m = createInitialLiveSessionModelState("s-ev");
    m.eventTail = [{ kind: "process_poll_sample", seq: 1 }];
    const prev = compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
    m.eventTail = [
      { kind: "process_poll_sample", seq: 1 },
      { kind: "process_poll_sample", seq: 2 },
    ];
    const scene = compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
    const spec = liveVisualSpecFromScene(scene, boundedSelectionIdCluster("cl_process"), {
      previousScene: prev,
    });
    const cmp = computeBoundedSceneCompare(prev, scene, {
      selectedId: boundedSelectionIdCluster("cl_process"),
    });
    const d = computeBoundedEvidenceDrilldown({
      scene,
      spec,
      compare: cmp,
      selectedSelectionId: boundedSelectionIdCluster("cl_process"),
      previousBoundedSampleCount: prev.boundedSampleCount,
      liveEventTail: m.eventTail,
      replay: null,
    });
    if (cmp.selectionCompareLine) {
      expect(d.compareSummaryLine).toContain(cmp.selectionCompareLine);
    }
  });
});

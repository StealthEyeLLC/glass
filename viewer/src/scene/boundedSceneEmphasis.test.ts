import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { initialReplayState, reduceReplay } from "../replay/replayModel.js";
import {
  CANONICAL_EVENT_SCHEMA_VERSION,
  PACK_FORMAT_SCAFFOLD_V0,
} from "../pack/types.js";
import type { GlassEvent, GlassManifest } from "../pack/types.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import { compileReplayToGlassSceneV0 } from "./compileReplayScene.js";
import { computeBoundedSceneEmphasis } from "./boundedSceneEmphasis.js";
import { sceneToDrawablePrimitives } from "./sceneToDrawablePrimitives.js";

const liveIdleBasis = {
  source: "live" as const,
  wireMode: "idle" as const,
  boundedSampleCount: 0,
  warningCode: null as string | null,
  resyncReason: null as string | null,
  reconcileSummary: null as string | null,
  snapshotOriginLabel: null as string | null,
  replayCursorIndex: null as number | null,
  replayEventTotal: null as number | null,
  replayPhase: "none" as const,
};

describe("computeBoundedSceneEmphasis", () => {
  it("starts calm with no previous emphasis", () => {
    const s = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("s"),
      lastReconcile: null,
    });
    expect(s.emphasis.wirePulseStep).toBe(0);
    expect(s.emphasis.samplePulseStep).toBe(0);
  });

  it("fires wire pulse when wire mode changes (pure basis diff)", () => {
    const first = computeBoundedSceneEmphasis(liveIdleBasis, null);
    const second = computeBoundedSceneEmphasis(
      { ...liveIdleBasis, wireMode: "replace" },
      {
        ...first,
        basis: liveIdleBasis,
      },
    );
    expect(second.wirePulseStep).toBe(3);
  });

  it("decays wire pulse when basis is unchanged", () => {
    const m = createInitialLiveSessionModelState("s");
    const a = compileLiveToGlassSceneV0({ model: m, lastReconcile: null });
    const b = compileLiveToGlassSceneV0({
      model: m,
      lastReconcile: null,
      previousEmphasis: { ...a.emphasis, wirePulseStep: 2 },
    });
    expect(b.emphasis.wirePulseStep).toBe(1);
  });

  it("fires sample pulse when bounded tail grows (live basis)", () => {
    const first = computeBoundedSceneEmphasis(liveIdleBasis, null);
    const second = computeBoundedSceneEmphasis(
      { ...liveIdleBasis, boundedSampleCount: 3 },
      {
        ...first,
        basis: liveIdleBasis,
      },
    );
    expect(second.samplePulseStep).toBe(3);
  });
});

function rm(): GlassManifest {
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

describe("replay emphasis transitions", () => {
  it("fires cursor pulse when replay cursor moves", () => {
    let st = initialReplayState();
    st = reduceReplay(st, {
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: rm(),
      events: [ev(1), ev(2), ev(3)],
    });
    st = reduceReplay(st, { type: "seek_index", index: 0 });
    const a = compileReplayToGlassSceneV0(st);
    st = reduceReplay(st, { type: "seek_index", index: 1 });
    const b = compileReplayToGlassSceneV0(st, { previousEmphasis: a.emphasis });
    expect(a.replayCursorIndex).toBe(0);
    expect(b.replayCursorIndex).toBe(1);
    expect(b.emphasis.replayCursorPulseStep).toBeGreaterThan(0);
  });
});

describe("emphasis primitive tags (Vertical Slice v4)", () => {
  it("adds overlay tags when wire pulse is active", () => {
    const idle = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("s"),
      lastReconcile: null,
    });
    const prim = sceneToDrawablePrimitives(idle);
    expect(prim.some((p) => p.semanticTag === "emphasis_wire_pulse_overlay")).toBe(false);

    const boosted: typeof idle = {
      ...idle,
      emphasis: { ...idle.emphasis, wirePulseStep: 2 },
    };
    const withPulse = sceneToDrawablePrimitives(boosted);
    expect(withPulse.some((p) => p.semanticTag === "emphasis_wire_pulse_overlay")).toBe(true);
  });
});

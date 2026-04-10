import { describe, expect, it } from "vitest";
import {
  CANONICAL_EVENT_SCHEMA_VERSION,
  PACK_FORMAT_SCAFFOLD_V0,
} from "../pack/types.js";
import type { GlassEvent, GlassManifest } from "../pack/types.js";
import { initialReplayState, reduceReplay } from "../replay/replayModel.js";
import { compileReplayToGlassSceneV0 } from "./compileReplayScene.js";
import { GLASS_SCENE_V0 } from "./glassSceneV0.js";

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

describe("compileReplayToGlassSceneV0", () => {
  it("produces idle scene when no pack", () => {
    const s = compileReplayToGlassSceneV0(initialReplayState());
    expect(s.kind).toBe(GLASS_SCENE_V0);
    expect(s.source).toBe("replay");
    expect(s.wireMode).toBe("idle");
    expect(s.honesty.sampleScope).toBe("empty");
  });

  it("uses append mode when cursor past first event", () => {
    let st = initialReplayState();
    st = reduceReplay(st, {
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: manifest(),
      events: [ev(1), ev(2)],
    });
    st = reduceReplay(st, { type: "seek_index", index: 1 });
    const s = compileReplayToGlassSceneV0(st);
    expect(s.wireMode).toBe("append");
    expect(s.boundedSampleCount).toBe(2);
    expect(s.totalEventCardinality).toBe(2);
  });

  it("maps load error to warning", () => {
    const st = reduceReplay(initialReplayState(), {
      type: "load_err",
      fileName: "bad",
      message: "not a zip",
    });
    const s = compileReplayToGlassSceneV0(st);
    expect(s.wireMode).toBe("warning");
    expect(s.warningCode).toBe("replay_load");
  });
});

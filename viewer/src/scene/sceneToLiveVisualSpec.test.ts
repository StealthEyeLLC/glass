import { describe, expect, it } from "vitest";
import { compileReplayToGlassSceneV0 } from "./compileReplayScene.js";
import { initialReplayState, reduceReplay } from "../replay/replayModel.js";
import { liveVisualSpecFromScene } from "./sceneToLiveVisualSpec.js";
import {
  CANONICAL_EVENT_SCHEMA_VERSION,
  PACK_FORMAT_SCAFFOLD_V0,
} from "../pack/types.js";
import type { GlassEvent, GlassManifest } from "../pack/types.js";

function m(): GlassManifest {
  return {
    pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
    session_id: "s",
    capture_mode: "replay",
    sanitized: false,
    human_readable_redaction_summary: [],
    share_safe_recommended: false,
  };
}

function e(seq: number): GlassEvent {
  return {
    schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
    event_id: `e${seq}`,
    session_id: "s",
    ts_ns: seq,
    seq,
    kind: "process_poll_sample",
    actor: { entity_type: "process", entity_id: "p" },
    attrs: {},
    source: {
      adapter: "t",
      quality: "direct",
      time_domain: "session_monotonic",
    },
  };
}

describe("liveVisualSpecFromScene (renderer boundary)", () => {
  it("maps replay scene to a renderable LiveVisualSpec", () => {
    const st = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "p.glass_pack",
      manifest: m(),
      events: [e(0)],
    });
    const scene = compileReplayToGlassSceneV0(st);
    const spec = liveVisualSpecFromScene(scene);
    expect(spec.mode).toBe("replace");
    expect(spec.eventTailCount).toBe(1);
    expect(spec.stripSource).toBe("replay");
    expect(spec.replayPrefixFraction).toBe(1);
    expect(spec.snapshotOriginLabel).toBeNull();
    expect(spec.actorClusterSummaryLine).toContain("Prefix");
    expect(spec.boundedCompositionCaption).toBe("Wire · System · Evidence");
    expect(spec.boundedEmphasisSummaryLine).toBeNull();
    expect(spec.boundedFocusCaptionLine).toBeNull();
  });
});

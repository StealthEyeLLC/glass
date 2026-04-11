import { describe, expect, it } from "vitest";
import { initialReplayState, reduceReplay } from "../replay/replayModel.js";
import {
  CANONICAL_EVENT_SCHEMA_VERSION,
  PACK_FORMAT_SCAFFOLD_V0,
} from "../pack/types.js";
import type { GlassEvent, GlassManifest } from "../pack/types.js";
import {
  countBoundedKindBuckets,
  deriveLiveBoundedActorClusters,
  deriveReplayBoundedActorClusters,
  eventKindFromUnknown,
  formatActorClusterSummaryLine,
} from "./boundedActorClusters.js";

describe("eventKindFromUnknown / countBoundedKindBuckets", () => {
  it("returns null for non-objects", () => {
    expect(eventKindFromUnknown(null)).toBeNull();
    expect(eventKindFromUnknown([])).toBeNull();
  });

  it("counts process vs file kinds in bounded list", () => {
    const ev = { kind: "process_poll_sample" };
    const ev2 = { kind: "file_poll_snapshot" };
    expect(countBoundedKindBuckets([ev, ev2, { kind: "network_burst" }])).toEqual({
      process: 1,
      file: 1,
      other: 1,
    });
  });
});

describe("deriveLiveBoundedActorClusters", () => {
  it("emits empty_tail cluster when no system flags and no typed events", () => {
    const c = deriveLiveBoundedActorClusters([], {
      snapshotOriginLabel: null,
      warningCode: null,
      resyncReason: null,
      reconcileSummary: null,
    });
    expect(c).toHaveLength(1);
    expect(c[0]?.lane).toBe("empty_sample");
  });

  it("includes process and file clusters from tail kinds", () => {
    const c = deriveLiveBoundedActorClusters(
      [{ kind: "process_poll_sample" }, { kind: "file_poll_snapshot" }],
      {
        snapshotOriginLabel: null,
        warningCode: null,
        resyncReason: null,
        reconcileSummary: null,
      },
    );
    const lanes = c.map((x) => x.lane);
    expect(lanes).toContain("process_samples");
    expect(lanes).toContain("file_samples");
  });

  it("prefers system cluster when warning is set", () => {
    const c = deriveLiveBoundedActorClusters([], {
      snapshotOriginLabel: null,
      warningCode: "W1",
      resyncReason: null,
      reconcileSummary: null,
    });
    expect(c[0]?.lane).toBe("system_attention");
  });
});

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

describe("deriveReplayBoundedActorClusters", () => {
  it("includes prefix and process counts for ready replay", () => {
    let st = initialReplayState();
    st = reduceReplay(st, {
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: manifest(),
      events: [ev(1), ev(2)],
    });
    st = reduceReplay(st, { type: "seek_index", index: 1 });
    const prefix = st.events.slice(0, st.cursorIndex + 1);
    const c = deriveReplayBoundedActorClusters(st, prefix);
    expect(c.map((x) => x.lane)).toContain("replay_index_prefix");
    expect(c.map((x) => x.lane)).toContain("process_samples");
  });
});

describe("formatActorClusterSummaryLine", () => {
  it("joins cluster labels deterministically", () => {
    const s = formatActorClusterSummaryLine([
      {
        id: "a",
        lane: "process_samples",
        label: "Process",
        sampleCount: 2,
        emphasis01: 0.5,
      },
    ]);
    expect(s).toContain("Process×2");
  });
});

import { describe, expect, it } from "vitest";
import type { GlassEvent, GlassManifest } from "../pack/types.js";
import {
  currentEvent,
  cursorFraction,
  entityRefsForEvent,
  initialReplayState,
  reduceReplay,
} from "./replayModel.js";

function man(sessionId: string, sanitized: boolean): GlassManifest {
  return {
    pack_format_version: "glass.pack.v0.scaffold",
    session_id: sessionId,
    capture_mode: "replay",
    sanitized,
    human_readable_redaction_summary: sanitized ? ["rule:a"] : [],
    share_safe_recommended: false,
  };
}

function ev(seq: number, sessionId: string): GlassEvent {
  return {
    schema_version: "glass.event.v0",
    event_id: `e${seq}`,
    session_id: sessionId,
    ts_ns: seq * 1000,
    seq,
    kind: "process_start",
    actor: { entity_type: "process", entity_id: "p1" },
    attrs: {},
    source: { adapter: "t", quality: "direct", time_domain: "session_monotonic" },
  };
}

describe("replayModel", () => {
  it("idle → reading → ready", () => {
    let s = initialReplayState();
    expect(s.loadStatus).toBe("idle");
    s = reduceReplay(s, { type: "start_reading", fileName: "a.glass_pack" });
    expect(s.loadStatus).toBe("reading");
    const m = man("ses", false);
    const events = [ev(1, "ses"), ev(2, "ses")];
    s = reduceReplay(s, {
      type: "load_ok",
      fileName: "a.glass_pack",
      manifest: m,
      events,
    });
    expect(s.loadStatus).toBe("ready");
    expect(s.cursorIndex).toBe(0);
    expect(s.playback).toBe("paused");
    expect(currentEvent(s)?.seq).toBe(1);
  });

  it("load error clears prior session", () => {
    let s = initialReplayState();
    s = reduceReplay(s, {
      type: "load_ok",
      fileName: "x",
      manifest: man("s", false),
      events: [ev(1, "s")],
    });
    s = reduceReplay(s, { type: "load_err", fileName: "bad.zip", message: "not a ZIP" });
    expect(s.loadStatus).toBe("error");
    expect(s.events.length).toBe(0);
  });

  it("play/pause and tick advance stop at end", () => {
    let s = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "x",
      manifest: man("s", false),
      events: [ev(1, "s"), ev(2, "s")],
    });
    s = reduceReplay(s, { type: "play" });
    expect(s.playback).toBe("playing");
    s = reduceReplay(s, { type: "tick_advance" });
    expect(s.cursorIndex).toBe(1);
    s = reduceReplay(s, { type: "tick_advance" });
    expect(s.cursorIndex).toBe(1);
    expect(s.playback).toBe("paused");
  });

  it("play on empty pack stays paused", () => {
    let s = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "e",
      manifest: man("s", false),
      events: [],
    });
    s = reduceReplay(s, { type: "play" });
    expect(s.playback).toBe("paused");
  });

  it("seek_fraction and seek_index clamp", () => {
    let s = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "x",
      manifest: man("s", false),
      events: [ev(1, "s"), ev(2, "s"), ev(3, "s")],
    });
    s = reduceReplay(s, { type: "seek_fraction", t: 1 });
    expect(s.cursorIndex).toBe(2);
    s = reduceReplay(s, { type: "seek_fraction", t: 0 });
    expect(s.cursorIndex).toBe(0);
    s = reduceReplay(s, { type: "seek_index", index: 99 });
    expect(s.cursorIndex).toBe(2);
    expect(s.playback).toBe("paused");
  });

  it("step_prev and step_next respect bounds", () => {
    let s = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "x",
      manifest: man("s", false),
      events: [ev(1, "s"), ev(2, "s")],
    });
    s = reduceReplay(s, { type: "step_prev" });
    expect(s.cursorIndex).toBe(0);
    s = reduceReplay(s, { type: "step_next" });
    s = reduceReplay(s, { type: "step_next" });
    expect(s.cursorIndex).toBe(1);
  });

  it("jump_start and jump_end", () => {
    let s = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "x",
      manifest: man("s", false),
      events: [ev(1, "s"), ev(2, "s"), ev(3, "s")],
    });
    s = reduceReplay(s, { type: "seek_index", index: 2 });
    s = reduceReplay(s, { type: "jump_start" });
    expect(s.cursorIndex).toBe(0);
    s = reduceReplay(s, { type: "jump_end" });
    expect(s.cursorIndex).toBe(2);
  });

  it("cursorFraction is 0 for 0 or 1 events", () => {
    const s0 = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "x",
      manifest: man("s", false),
      events: [],
    });
    expect(cursorFraction(s0)).toBe(0);
    const s1 = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "x",
      manifest: man("s", false),
      events: [ev(1, "s")],
    });
    expect(cursorFraction(s1)).toBe(0);
  });

  it("select_entity toggles", () => {
    let s = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "x",
      manifest: man("s", false),
      events: [ev(1, "s")],
    });
    s = reduceReplay(s, { type: "select_entity", entityId: "p1" });
    expect(s.selectedEntityId).toBe("p1");
    s = reduceReplay(s, { type: "select_entity", entityId: null });
    expect(s.selectedEntityId).toBeNull();
  });

  it("entityRefsForEvent lists actor and optional edges", () => {
    const e: GlassEvent = {
      ...ev(1, "s"),
      subject: { entity_type: "file", entity_id: "f1" },
    };
    const refs = entityRefsForEvent(e);
    expect(refs.map((r) => r.role)).toEqual(["actor", "subject"]);
  });

  it("close_pack returns to idle", () => {
    let s = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "x",
      manifest: man("s", false),
      events: [ev(1, "s")],
    });
    s = reduceReplay(s, { type: "close_pack" });
    expect(s.loadStatus).toBe("idle");
    expect(s.events.length).toBe(0);
  });
});

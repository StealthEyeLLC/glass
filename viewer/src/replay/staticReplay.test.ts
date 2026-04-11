import { afterEach, describe, expect, it, vi } from "vitest";
import { getBuildMode } from "../app/mode.js";
import type { GlassEvent, GlassManifest } from "../pack/types.js";
import {
  CANONICAL_EVENT_SCHEMA_VERSION,
  PACK_FORMAT_SCAFFOLD_V0,
} from "../pack/types.js";
import { GLASS_SCENE_V0 } from "../scene/glassSceneV0.js";
import { mountReplayShell } from "./replayOnlyShell.js";

function sampleManifest(sanitized: boolean): GlassManifest {
  return {
    pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
    session_id: "ses_ui",
    capture_mode: "replay",
    sanitized,
    human_readable_redaction_summary: sanitized
      ? ["rule:argv_tail", "rule:private_ip"]
      : [],
    share_safe_recommended: false,
  };
}

function sampleEvent(seq: number): GlassEvent {
  return {
    schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
    event_id: `evt_${seq}`,
    session_id: "ses_ui",
    ts_ns: seq * 100,
    seq,
    kind: "process_start",
    actor: { entity_type: "process", entity_id: "proc_ui" },
    attrs: { note: "test" },
    source: {
      adapter: "ui",
      quality: "direct",
      time_domain: "session_monotonic",
    },
  };
}

describe("static replay shell", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("build is replay-only", () => {
    expect(getBuildMode()).toBe("static_replay");
  });

  it("does not auto-fetch dev fixture when ?fixture=vertical_slice_v0 (tests mirror production inert)", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      Promise.resolve(new Response()),
    );
    history.replaceState({}, "", "/?fixture=vertical_slice_v0");
    try {
      const root = document.createElement("div");
      mountReplayShell(root);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      fetchSpy.mockRestore();
      history.replaceState({}, "", "/");
    }
  });

  it("mounts vertical slice hero, drop zone, and file open control", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    expect(root.querySelector('[data-testid="replay-vs-hero"]')).toBeTruthy();
    expect(root.textContent).toContain("static replay");
    expect(root.querySelector(".glass-drop-zone")).toBeTruthy();
    expect(root.querySelector('[data-testid="replay-open-file"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="replay-file-input"]')).toBeTruthy();
  });

  it("mounts bounded episodes + temporal lens roots (Vertical Slice v12)", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    expect(root.querySelector('[data-testid="replay-bounded-episodes-root"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="replay-temporal-lens-root"]')).toBeTruthy();
  });

  it("mounts Scene System v0 bounded canvas", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    expect(root.querySelector('[data-testid="replay-scene-v0"]')).toBeTruthy();
    const cv = root.querySelector('[data-testid="replay-scene-canvas"]') as HTMLCanvasElement | null;
    expect(cv).toBeTruthy();
    expect(cv?.getAttribute("data-scene")).toBe(GLASS_SCENE_V0);
  });

  it("mounts Vertical Slice v7 bounded selection inspector", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    const bi = root.querySelector('[data-testid="replay-bounded-inspector"]');
    expect(bi).toBeTruthy();
    expect(bi?.textContent).toMatch(/Selection: \(none\)|Click a scene/i);
  });

  it("shows pack metadata and inspector after programmatic load", () => {
    const root = document.createElement("div");
    const h = mountReplayShell(root);
    const events = [sampleEvent(1), sampleEvent(2)];
    h.dispatch({
      type: "load_ok",
      fileName: "t.glass_pack",
      manifest: sampleManifest(false),
      events,
    });
    const meta = root.querySelector('[data-testid="replay-meta"]');
    expect(meta?.textContent).toContain("ses_ui");
    expect(meta?.textContent).toContain("t.glass_pack");
    const inspector = root.querySelector('[data-testid="replay-inspector"]');
    expect(inspector?.textContent).toContain("process_start");
    expect(inspector?.textContent).toContain("proc_ui");
    expect(h.getState().cursorIndex).toBe(0);
  });

  it("shows redaction summary when pack is sanitized", () => {
    const root = document.createElement("div");
    const h = mountReplayShell(root);
    h.dispatch({
      type: "load_ok",
      fileName: "san.glass_pack",
      manifest: sampleManifest(true),
      events: [sampleEvent(1)],
    });
    const box = root.querySelector('[data-testid="replay-sanitized"]');
    expect(box?.textContent).toContain("Sanitized pack");
    expect(box?.textContent).toContain("rule:argv_tail");
    expect(h.getState().manifest?.sanitized).toBe(true);
  });

  it("timeline seek updates cursor and inspector", () => {
    const root = document.createElement("div");
    const h = mountReplayShell(root);
    h.dispatch({
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: sampleManifest(false),
      events: [sampleEvent(1), sampleEvent(2)],
    });
    const buttons = root.querySelectorAll(
      '[data-testid="replay-timeline"] button',
    );
    expect(buttons.length).toBe(2);
    buttons[1]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(h.getState().cursorIndex).toBe(1);
    expect(
      root.querySelector('[data-testid="replay-inspector"]')?.textContent,
    ).toContain('"seq": 2');
  });

  it("entity chip toggles selection", () => {
    const root = document.createElement("div");
    const h = mountReplayShell(root);
    h.dispatch({
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: sampleManifest(false),
      events: [sampleEvent(1)],
    });
    const chip = root.querySelector(
      '[data-testid="replay-entity-chips"] .glass-entity-chip',
    );
    expect(chip).toBeTruthy();
    chip?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(h.getState().selectedEntityId).toBe("proc_ui");
    chip?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(h.getState().selectedEntityId).toBeNull();
  });

  it("play advances cursor then pause at end", async () => {
    vi.useFakeTimers();
    const root = document.createElement("div");
    const h = mountReplayShell(root);
    h.dispatch({
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: sampleManifest(false),
      events: [sampleEvent(1), sampleEvent(2)],
    });
    root.querySelector('[data-testid="replay-play"]')?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(h.getState().playback).toBe("playing");
    await vi.advanceTimersByTimeAsync(400);
    expect(h.getState().cursorIndex).toBe(1);
    await vi.advanceTimersByTimeAsync(400);
    expect(h.getState().cursorIndex).toBe(1);
    expect(h.getState().playback).toBe("paused");
    vi.useRealTimers();
  });

  it("shows empty-pack message and keeps play disabled", () => {
    const root = document.createElement("div");
    const h = mountReplayShell(root);
    h.dispatch({
      type: "load_ok",
      fileName: "empty.glass_pack",
      manifest: sampleManifest(false),
      events: [],
    });
    expect(
      root.querySelector('[data-testid="replay-position"]')?.textContent,
    ).toContain("No events");
    const play = root.querySelector(
      '[data-testid="replay-play"]',
    ) as HTMLButtonElement;
    expect(play.disabled).toBe(true);
  });

  it("shows load error and close returns to idle", () => {
    const root = document.createElement("div");
    const h = mountReplayShell(root);
    h.dispatch({
      type: "load_err",
      fileName: "bad.glass_pack",
      message: "not a ZIP (missing PK header)",
    });
    const err = root.querySelector('[data-testid="replay-error"]');
    expect(err?.textContent).toContain("not a ZIP");
    root
      .querySelector('[data-testid="replay-close"]')
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(h.getState().loadStatus).toBe("idle");
  });

  it("scrubber changes cursor", () => {
    const root = document.createElement("div");
    const h = mountReplayShell(root);
    h.dispatch({
      type: "load_ok",
      fileName: "x.glass_pack",
      manifest: sampleManifest(false),
      events: [sampleEvent(1), sampleEvent(2), sampleEvent(3)],
    });
    const scrub = root.querySelector(
      '[data-testid="replay-scrub"]',
    ) as HTMLInputElement;
    scrub.value = "1000";
    scrub.dispatchEvent(new Event("input", { bubbles: true }));
    expect(h.getState().cursorIndex).toBe(2);
  });
});

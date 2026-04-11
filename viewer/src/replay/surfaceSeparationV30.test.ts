import { afterEach, describe, expect, it, vi } from "vitest";
import { mountReplayShell } from "./replayOnlyShell.js";
import { mountLiveSessionShell } from "../live/liveSessionShell.js";

describe("Vertical Slice v30 — easy vs technical surfaces", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    history.replaceState({}, "", "/");
  });

  it("replay: Overview is default and technical chrome is in DOM", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    expect(root.querySelector('[data-testid="glass-surface-bar"]')).not.toBeNull();
    expect(root.dataset.surface).toBe("easy");
    expect(root.querySelector('[data-testid="replay-technical-chrome"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="replay-flagship-callout"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="replay-scene-note-overview"]')).not.toBeNull();
  });

  it("replay: technical control exposes full flagship bundle", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    const tech = root.querySelector('[data-testid="glass-surface-technical"]') as HTMLButtonElement;
    expect(tech).not.toBeNull();
    tech.click();
    expect(root.dataset.surface).toBe("technical");
  });

  it("live: Overview default; operator instrumentation exists for Technical", () => {
    const root = document.createElement("div");
    mountLiveSessionShell(root);
    expect(root.dataset.surface).toBe("easy");
    expect(root.querySelector('[data-testid="live-operator-instrumentation"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-technical-chrome"]')).not.toBeNull();
  });
});

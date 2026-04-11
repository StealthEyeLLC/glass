/**
 * Vertical Slice v32 — premium visual hierarchy (CSS + root class only; no semantics).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountLiveSessionShell } from "../live/liveSessionShell.js";
import { mountReplayShell } from "./replayOnlyShell.js";

describe("Vertical Slice v32 — premium visual pass (bounded showcase)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    history.replaceState({}, "", "/");
  });

  it("replay root carries showcase v32 class for premium styling", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    expect(root.classList.contains("glass-replay-root")).toBe(true);
    expect(root.classList.contains("glass-showcase-v32")).toBe(true);
  });

  it("live root carries showcase v32 class (replay/live visual family)", () => {
    const root = document.createElement("div");
    mountLiveSessionShell(root);
    expect(root.classList.contains("glass-live-root")).toBe(true);
    expect(root.classList.contains("glass-showcase-v32")).toBe(true);
  });

  it("Overview default surface and primary action markers unchanged", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    expect(root.dataset.surface).toBe("easy");
    expect(root.querySelector('[data-testid="replay-overview-primary-actions"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="glass-surface-bar"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="glass-surface-easy"]')).not.toBeNull();
  });

  it("Technical surface toggle and technical-only chrome class preserved", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    const tech = root.querySelector('[data-testid="glass-surface-technical"]') as HTMLButtonElement;
    tech.click();
    expect(root.dataset.surface).toBe("technical");
    const chrome = root.querySelector('[data-testid="replay-technical-chrome"]') as HTMLElement;
    expect(chrome.classList.contains("glass-surface-technical-only")).toBe(true);
  });
});

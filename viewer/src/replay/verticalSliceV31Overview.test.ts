/**
 * Vertical Slice v31 — Overview default surface: minimal sections, dense truth in Technical.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { VERTICAL_SLICE_V27_READING_ORDER_REPLAY_TECHNICAL } from "../app/verticalSliceV0.js";
import { mountReplayShell } from "./replayOnlyShell.js";

describe("Vertical Slice v31 — Overview surface reduction", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    history.replaceState({}, "", "/");
  });

  it("Overview idle: downstream trust stack is marked loaded-only (hidden via v31 CSS)", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    expect(root.dataset.surface).toBe("easy");
    expect(root.dataset.overviewPhase).toBe("idle");
    const scene = root.querySelector('[data-testid="replay-scene-v0"]') as HTMLElement;
    expect(scene.classList.contains("glass-overview-loaded-only")).toBe(true);
  });

  it("Technical retains flagship / reading-order / index-ordered phrasing", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    const tech = root.querySelector('[data-testid="glass-surface-technical"]') as HTMLButtonElement;
    tech.click();
    expect(root.dataset.surface).toBe("technical");
    expect(root.textContent).toContain("index-ordered");
    expect(root.textContent).toContain(VERTICAL_SLICE_V27_READING_ORDER_REPLAY_TECHNICAL);
  });

  it("Overview helper stays short and omits temporal-baseline receipt supplement wording", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    const helper = root.querySelector('[data-testid="replay-overview-helper"]');
    expect(helper?.textContent).toContain("Load a session");
    expect(helper?.textContent?.toLowerCase()).not.toContain("compare baseline");
  });

  it("Overview shows primary action row and helper; technical chrome is technical-only class", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    expect(root.querySelector('[data-testid="replay-overview-primary-actions"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="replay-overview-helper"]')).not.toBeNull();
    const chrome = root.querySelector('[data-testid="replay-technical-chrome"]') as HTMLElement;
    expect(chrome.classList.contains("glass-surface-technical-only")).toBe(true);
  });

  it("section order: Scene → Evidence → Claim → Time → Episodes", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    const ids = [
      "replay-scene-v0",
      "replay-evidence-section",
      "replay-claim-section",
      "replay-temporal-lens",
      "replay-episodes-section",
    ];
    const els = ids.map((id) => root.querySelector(`[data-testid="${id}"]`) as HTMLElement | null);
    for (let i = 0; i < els.length - 1; i++) {
      const a = els[i];
      const b = els[i + 1];
      expect(a).not.toBeNull();
      expect(b).not.toBeNull();
      if (a === null || b === null) {
        return;
      }
      expect(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }
  });
});

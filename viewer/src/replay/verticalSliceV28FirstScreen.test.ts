import { afterEach, describe, expect, it, vi } from "vitest";
import {
  VERTICAL_SLICE_V28_READING_ORDER_REPLAY_MICRO,
  VERTICAL_SLICE_V28_REPLAY_HERO_LEAD,
} from "../app/verticalSliceV0.js";
import { mountLiveSessionShell } from "../live/liveSessionShell.js";
import { mountReplayShell } from "./replayOnlyShell.js";

describe("Vertical Slice v28 — calm default first screen", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replay: primary load actions come before flagship bundle; hero is one short line + details", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    const kids = [...root.children].map((n) => n.getAttribute("data-testid"));
    const idxEasy = kids.indexOf("replay-easy-entry");
    const idxTech = kids.indexOf("replay-technical-chrome");
    expect(idxEasy).toBeGreaterThan(-1);
    expect(idxTech).toBeGreaterThan(-1);
    expect(idxEasy).toBeLessThan(idxTech);
    expect(root.querySelector('[data-testid="replay-flagship-callout"]')).not.toBeNull();

    const hero = root.querySelector('[data-testid="replay-vs-hero"]');
    expect(hero?.textContent).toContain(VERTICAL_SLICE_V28_REPLAY_HERO_LEAD);
    expect(root.querySelector('[data-testid="replay-hero-context"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="replay-flagship-bundle"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="replay-reading-order-micro"]')?.textContent).toBe(
      VERTICAL_SLICE_V28_READING_ORDER_REPLAY_MICRO,
    );
  });

  it("replay: technical reading order + flagship doc still present in DOM", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    const tech = root.querySelector('[data-testid="replay-reading-order-technical"]');
    expect(tech?.textContent).toContain("index-ordered");
    const bundle = root.querySelector('[data-testid="replay-flagship-bundle"]');
    expect(bundle?.textContent).toContain("Glass lets you move");
  });

  it("live: hero is short line; long copy under About live mode", () => {
    const root = document.createElement("div");
    mountLiveSessionShell(root);
    const hero = root.querySelector('[data-testid="live-vs-hero"]');
    expect(hero?.textContent).toContain("Same panels as replay");
    expect(root.querySelector('[data-testid="live-hero-context"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-flagship-framing-technical"]')?.textContent).toContain(
      "bounded scene state",
    );
  });
});

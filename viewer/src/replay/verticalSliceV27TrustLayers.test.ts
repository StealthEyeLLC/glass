import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GLASS_FLAGSHIP_CHAIN_ONE_LINER,
  VERTICAL_SLICE_V27_FLAGSHIP_FRAMING_SIMPLE,
  VERTICAL_SLICE_V27_READING_ORDER_LIVE_SIMPLE,
  VERTICAL_SLICE_V27_READING_ORDER_LIVE_TECHNICAL,
  VERTICAL_SLICE_V27_READING_ORDER_REPLAY_SIMPLE,
  VERTICAL_SLICE_V27_READING_ORDER_REPLAY_TECHNICAL,
} from "../app/verticalSliceV0.js";
import { mountLiveSessionShell } from "../live/liveSessionShell.js";
import { mountReplayShell } from "./replayOnlyShell.js";

describe("Vertical Slice v27 — simple vs technical trust layers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("replay: simple reading order is default; technical scan string is behind details", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    const simple = root.querySelector('[data-testid="replay-reading-order-simple"]');
    expect(simple?.textContent).toBe(VERTICAL_SLICE_V27_READING_ORDER_REPLAY_SIMPLE);
    expect(simple?.textContent).not.toContain("index-ordered");
    const tech = root.querySelector('[data-testid="replay-reading-order-technical"]');
    expect(tech?.textContent).toContain(VERTICAL_SLICE_V27_READING_ORDER_REPLAY_TECHNICAL);
    expect(tech?.textContent).toContain("index-ordered");
    expect(tech?.textContent).toContain(GLASS_FLAGSHIP_CHAIN_ONE_LINER);
  });

  it("replay: flagship copy lives in bundled details; GLASS_FLAGSHIP_CHAIN_DOC + append-heavy remain", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    const framing = root.querySelector('[data-testid="replay-flagship-framing"]');
    expect(framing?.textContent).toBe(VERTICAL_SLICE_V27_FLAGSHIP_FRAMING_SIMPLE);
    const bundle = root.querySelector('[data-testid="replay-flagship-bundle"]');
    expect(bundle?.textContent).toContain("append-heavy");
    expect(bundle?.textContent).toContain("Glass lets you move");
  });

  it("live: simple reading order + technical parity block", () => {
    const root = document.createElement("div");
    mountLiveSessionShell(root);
    const simple = root.querySelector('[data-testid="live-reading-order-simple"]');
    expect(simple?.textContent).toBe(VERTICAL_SLICE_V27_READING_ORDER_LIVE_SIMPLE);
    const tech = root.querySelector('[data-testid="live-reading-order-technical"]');
    expect(tech?.textContent).toContain(VERTICAL_SLICE_V27_READING_ORDER_LIVE_TECHNICAL);
    expect(tech?.textContent).toContain("WS tail");
  });
});

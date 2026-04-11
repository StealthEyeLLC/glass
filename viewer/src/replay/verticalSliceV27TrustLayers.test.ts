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

  it("replay: flagship default framing is simple; GLASS_FLAGSHIP_CHAIN_DOC is in technical path block", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    const framing = root.querySelector('[data-testid="replay-flagship-framing"]');
    expect(framing?.textContent).toBe(VERTICAL_SLICE_V27_FLAGSHIP_FRAMING_SIMPLE);
    const pathTech = root.querySelector('[data-testid="replay-flagship-path-technical"]');
    expect(pathTech?.textContent).toContain("append-heavy");
    expect(pathTech?.textContent).toContain("Glass lets you move");
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

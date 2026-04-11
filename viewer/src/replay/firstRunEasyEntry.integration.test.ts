import { describe, expect, it } from "vitest";
import { mountLiveSessionShell } from "../live/liveSessionShell.js";
import { mountReplayShell } from "./replayOnlyShell.js";

describe("Vertical Slice v26 easy-first entry (bounded showcase)", () => {
  it("replay: easy entry precedes live nav; primary live link hides query flag in label", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    const order = root.querySelectorAll(
      '[data-testid="replay-easy-entry"], [data-testid="replay-live-nav"]',
    );
    expect(order.length).toBe(2);
    expect(order[0].getAttribute("data-testid")).toBe("replay-easy-entry");
    expect(order[1].getAttribute("data-testid")).toBe("replay-live-nav");

    const primary = root.querySelector('[data-testid="replay-link-live-session"]');
    expect(primary?.textContent).not.toContain("?live=");
    expect(primary?.textContent).not.toMatch(/127\.0\.0\.1/);

    expect(root.querySelector('[data-testid="replay-flagship-easy-summary"]')).not.toBeNull();
    const technical = root.querySelector('[data-testid="replay-flagship-technical-details"]');
    expect(technical?.textContent).toContain("?fixture=flagship");
  });

  it("replay: dev build exposes one-click flagship load", () => {
    const root = document.createElement("div");
    mountReplayShell(root);
    if (import.meta.env.DEV) {
      const cta = root.querySelector('[data-testid="replay-easy-flagship-load"]');
      expect(cta).not.toBeNull();
      expect((cta as HTMLAnchorElement).getAttribute("href")).toContain("fixture=flagship");
    }
  });

  it("live: easy intro and connection settings collapsed; bridge placeholder is not a literal loopback IP", () => {
    const root = document.createElement("div");
    mountLiveSessionShell(root);
    expect(root.querySelector('[data-testid="live-easy-intro"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-connection-advanced"]')).not.toBeNull();
    const url = root.querySelector('[data-testid="live-bridge-url"]') as HTMLInputElement;
    expect(url.placeholder).not.toContain("127.0.0.1");

    const hero = root.querySelector('[data-testid="live-vs-hero"]');
    expect(hero?.textContent).not.toContain("?live=1");

    const back = root.querySelector('[data-testid="live-back-to-replay"]');
    expect(back?.textContent).not.toContain("?live");
  });
});

import { describe, expect, it } from "vitest";
import { mountLiveSessionShell } from "./liveSessionShell.js";

describe("mountLiveSessionShell", () => {
  it("mounts live state panel and bounded event region", () => {
    const root = document.createElement("div");
    mountLiveSessionShell(root);
    expect(root.querySelector('[data-testid="live-state-panel"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-event-list"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-tail-origin"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-connect"]')).not.toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { bridgeHttpToLiveWsUrl } from "./liveSessionHttp.js";

describe("bridgeHttpToLiveWsUrl", () => {
  it("maps http to ws with access_token", () => {
    const u = bridgeHttpToLiveWsUrl("http://127.0.0.1:9781", "tok_x");
    expect(u.startsWith("ws://127.0.0.1:9781/ws?")).toBe(true);
    expect(u).toContain("access_token=tok_x");
  });

  it("maps https to wss", () => {
    const u = bridgeHttpToLiveWsUrl("https://127.0.0.1:9781/", "t");
    expect(u.startsWith("wss://127.0.0.1:9781/ws?")).toBe(true);
  });
});

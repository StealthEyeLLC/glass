import { describe, expect, it } from "vitest";
import {
  LIVE_STORAGE_KEYS,
  loadLiveFormPrefs,
  saveLiveBridgeUrl,
  saveLiveFormPrefs,
} from "./liveSessionStorage.js";

function mockStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem(k: string) {
      return m.get(k) ?? null;
    },
    setItem(k: string, v: string) {
      m.set(k, v);
    },
    removeItem(k: string) {
      m.delete(k);
    },
    clear() {
      m.clear();
    },
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

describe("loadLiveFormPrefs / saveLiveFormPrefs", () => {
  it("round-trips bridge URL, session id, delta wire (no token key exists)", () => {
    const s = mockStorage();
    saveLiveFormPrefs(
      {
        bridgeUrl: "http://127.0.0.1:9781",
        sessionId: "ses_a",
        sessionDeltaWire: true,
      },
      s,
    );
    expect(s.getItem(LIVE_STORAGE_KEYS.bridgeUrl)).toBe("http://127.0.0.1:9781");
    expect(s.getItem(LIVE_STORAGE_KEYS.sessionId)).toBe("ses_a");
    expect(s.getItem(LIVE_STORAGE_KEYS.sessionDeltaWire)).toBe("1");
    const l = loadLiveFormPrefs(s);
    expect(l.bridgeUrl).toBe("http://127.0.0.1:9781");
    expect(l.sessionId).toBe("ses_a");
    expect(l.sessionDeltaWire).toBe(true);
  });

  it("saveLiveBridgeUrl does not set token", () => {
    const s = mockStorage();
    saveLiveBridgeUrl("http://x", s);
    expect(s.getItem(LIVE_STORAGE_KEYS.bridgeUrl)).toBe("http://x");
    expect(s.getItem("token")).toBeNull();
  });
});

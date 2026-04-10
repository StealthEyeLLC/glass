/**
 * sessionStorage keys for live-shell convenience only.
 * **Bearer token is intentionally not persisted** (operator re-enters per browser session).
 */

export const LIVE_STORAGE_KEYS = {
  bridgeUrl: "glass_live_v0_bridge_url",
  sessionId: "glass_live_v0_session_id",
  sessionDeltaWire: "glass_live_v0_session_delta_wire",
} as const;

export interface LiveFormPrefs {
  bridgeUrl: string;
  sessionId: string;
  sessionDeltaWire: boolean;
}

const mem: Storage = (() => {
  if (typeof sessionStorage !== "undefined") {
    return sessionStorage;
  }
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
    get length() {
      return m.size;
    },
    key() {
      return null;
    },
  } as Storage;
})();

/** In tests, pass a mock Storage. Default: `sessionStorage`. */
export function loadLiveFormPrefs(storage: Storage = mem): Partial<LiveFormPrefs> {
  const bridgeUrl = storage.getItem(LIVE_STORAGE_KEYS.bridgeUrl) ?? "";
  const sessionId = storage.getItem(LIVE_STORAGE_KEYS.sessionId) ?? "";
  const dw = storage.getItem(LIVE_STORAGE_KEYS.sessionDeltaWire);
  const sessionDeltaWire = dw === "1";
  const out: Partial<LiveFormPrefs> = {};
  if (bridgeUrl) {
    out.bridgeUrl = bridgeUrl;
  }
  if (sessionId) {
    out.sessionId = sessionId;
  }
  if (dw === "0" || dw === "1") {
    out.sessionDeltaWire = sessionDeltaWire;
  }
  return out;
}

export function saveLiveFormPrefs(
  prefs: LiveFormPrefs,
  storage: Storage = mem,
): void {
  storage.setItem(LIVE_STORAGE_KEYS.bridgeUrl, prefs.bridgeUrl);
  storage.setItem(LIVE_STORAGE_KEYS.sessionId, prefs.sessionId);
  storage.setItem(
    LIVE_STORAGE_KEYS.sessionDeltaWire,
    prefs.sessionDeltaWire ? "1" : "0",
  );
}

/** Safe partial save after preflight (token not involved). */
export function saveLiveBridgeUrl(url: string, storage: Storage = mem): void {
  storage.setItem(LIVE_STORAGE_KEYS.bridgeUrl, url);
}

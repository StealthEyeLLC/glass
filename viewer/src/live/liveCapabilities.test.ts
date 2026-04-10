import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBridgeCapabilities,
  parseBridgeCapabilitiesJson,
} from "./liveCapabilities.js";

describe("parseBridgeCapabilitiesJson", () => {
  it("accepts bridge capabilities shape", () => {
    const raw = {
      bridge_api_version: 1,
      resync: {
        provisional_backlog_event_threshold: 10000,
        recovery_strategy: "snapshot_and_cursor",
      },
      websocket: {
        path: "/ws",
        delta_stream_status: "live_session_delta_skeleton_polling",
        live_session_delta_skeleton: true,
        session_delta_wire_v0: true,
      },
      live_session_ingest: true,
      collector_fipc: {
        transport: "provisional_tcp_loopback",
        configured: true,
        wire_protocol_version: 1,
      },
    };
    const p = parseBridgeCapabilitiesJson(raw);
    expect(p.ok).toBe(true);
    if (p.ok) {
      expect(p.value.collector_fipc.configured).toBe(true);
      expect(p.value.websocket.session_delta_wire_v0).toBe(true);
      expect(p.value.websocket.live_session_delta_skeleton).toBe(true);
    }
  });

  it("rejects non-object", () => {
    const p = parseBridgeCapabilitiesJson(null);
    expect(p.ok).toBe(false);
  });
});

describe("fetchBridgeCapabilities", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps HTTP errors to ok:false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve("nope"),
      }),
    );
    const r = await fetchBridgeCapabilities("http://127.0.0.1:9", "t");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("401");
    }
  });

  it("parses ok JSON", async () => {
    const body = {
      bridge_api_version: 1,
      resync: {
        provisional_backlog_event_threshold: 10,
        recovery_strategy: "snapshot_and_cursor",
      },
      websocket: {
        path: "/ws",
        delta_stream_status: "handshake_only_no_live_deltas",
        live_session_delta_skeleton: false,
        session_delta_wire_v0: false,
      },
      live_session_ingest: false,
      collector_fipc: {
        transport: "provisional_tcp_loopback",
        configured: false,
        wire_protocol_version: 1,
      },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      }),
    );
    const r = await fetchBridgeCapabilities("http://127.0.0.1:9781", "tok");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.collector_fipc.configured).toBe(false);
    }
  });
});

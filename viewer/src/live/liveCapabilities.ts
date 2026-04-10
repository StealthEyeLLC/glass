/**
 * `GET /capabilities` — additive bridge metadata; not F-04.
 */

export interface BridgeCapabilitiesLive {
  bridge_api_version: number;
  collector_fipc: {
    transport: string;
    configured: boolean;
    wire_protocol_version: number;
  };
  websocket: {
    path: string;
    delta_stream_status: string;
    live_session_delta_skeleton: boolean;
    session_delta_wire_v0: boolean;
  };
  live_session_ingest: boolean;
  resync: {
    provisional_backlog_event_threshold: number;
    recovery_strategy: string;
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/** Parse JSON body from `/capabilities` (strict enough for UI; fails closed on shape drift). */
export function parseBridgeCapabilitiesJson(
  raw: unknown,
): { ok: true; value: BridgeCapabilitiesLive } | { ok: false; error: string } {
  if (!isRecord(raw)) {
    return { ok: false, error: "capabilities: not a JSON object" };
  }
  const bridge_api_version = raw.bridge_api_version;
  if (typeof bridge_api_version !== "number") {
    return { ok: false, error: "capabilities: missing bridge_api_version" };
  }
  const cf = raw.collector_fipc;
  const ws = raw.websocket;
  const resync = raw.resync;
  if (!isRecord(cf) || !isRecord(ws) || !isRecord(resync)) {
    return { ok: false, error: "capabilities: missing nested objects" };
  }
  if (typeof cf.configured !== "boolean" || typeof cf.transport !== "string") {
    return { ok: false, error: "capabilities: invalid collector_fipc" };
  }
  if (
    typeof ws.live_session_delta_skeleton !== "boolean" ||
    typeof ws.session_delta_wire_v0 !== "boolean" ||
    typeof ws.delta_stream_status !== "string" ||
    typeof ws.path !== "string"
  ) {
    return { ok: false, error: "capabilities: invalid websocket" };
  }
  const live = raw.live_session_ingest;
  if (typeof live !== "boolean") {
    return { ok: false, error: "capabilities: missing live_session_ingest" };
  }
  const wpv = cf.wire_protocol_version;
  if (typeof wpv !== "number") {
    return { ok: false, error: "capabilities: missing wire_protocol_version" };
  }
  return {
    ok: true,
    value: {
      bridge_api_version,
      collector_fipc: {
        transport: cf.transport,
        configured: cf.configured,
        wire_protocol_version: wpv,
      },
      websocket: {
        path: ws.path,
        delta_stream_status: ws.delta_stream_status,
        live_session_delta_skeleton: ws.live_session_delta_skeleton,
        session_delta_wire_v0: ws.session_delta_wire_v0,
      },
      live_session_ingest: live,
      resync: {
        provisional_backlog_event_threshold: Number(
          resync.provisional_backlog_event_threshold,
        ),
        recovery_strategy: String(resync.recovery_strategy ?? ""),
      },
    },
  };
}

export async function fetchBridgeCapabilities(
  bridgeBaseUrl: string,
  bearerToken: string,
  signal?: AbortSignal,
): Promise<
  { ok: true; value: BridgeCapabilitiesLive } | { ok: false; error: string }
> {
  const base = bridgeBaseUrl.replace(/\/$/, "");
  const url = `${base}/capabilities`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        Accept: "application/json",
      },
      signal,
    });
  } catch (e) {
    return {
      ok: false,
      error: `capabilities fetch failed: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (!res.ok) {
    const t = await res.text();
    return {
      ok: false,
      error: `capabilities HTTP ${res.status}: ${t.slice(0, 400)}`,
    };
  }
  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    return { ok: false, error: "capabilities: invalid JSON body" };
  }
  return parseBridgeCapabilitiesJson(raw);
}

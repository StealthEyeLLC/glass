/**
 * Bridge `GET /sessions/:id/snapshot` — bounded F-04 JSON consumer (read-only).
 */

export interface BoundedSnapshotF04 {
  session_id: string;
  snapshot_cursor: string;
  events: unknown[];
  bounded_snapshot?: {
    snapshot_origin: string;
    returned_events: number;
    available_in_view: number;
    truncated_by_max_events: boolean;
    cursor_semantics: string;
  } | null;
  resync_hint?: unknown;
  retained_snapshot_unix_ms?: number | null;
  collector_ipc?: { transport: string; status: string; detail?: string | null };
  max_events_requested?: number | null;
}

export async function fetchBoundedSnapshot(
  bridgeBaseUrl: string,
  bearerToken: string,
  sessionId: string,
  signal?: AbortSignal,
): Promise<BoundedSnapshotF04> {
  const base = bridgeBaseUrl.replace(/\/$/, "");
  const url = `${base}/sessions/${encodeURIComponent(sessionId)}/snapshot`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      Accept: "application/json",
    },
    signal,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`snapshot HTTP ${res.status}: ${t.slice(0, 500)}`);
  }
  return res.json() as Promise<BoundedSnapshotF04>;
}

/** Build `ws:` URL for `GET /ws` with query token (bridge provisional auth). */
export function bridgeHttpToLiveWsUrl(
  bridgeBaseUrl: string,
  accessToken: string,
): string {
  const u = new URL(bridgeBaseUrl);
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("bridge base must be http(s) URL");
  }
  const wsProto = u.protocol === "https:" ? "wss:" : "ws:";
  const origin = `${wsProto}//${u.host}`;
  const ws = new URL("/ws", origin);
  ws.searchParams.set("access_token", accessToken);
  return ws.toString();
}

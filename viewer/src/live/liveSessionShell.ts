/**
 * Minimal live-session UI: connect to bridge WebSocket, subscribe, show wire-derived state.
 * No WebGPU; bounded debug surface only.
 */

import {
  applyLiveSessionLine,
  createInitialLiveSessionModelState,
  type LiveSessionModelState,
} from "./applyLiveSessionMessage.js";
import { fetchBridgeCapabilities, type BridgeCapabilitiesLive } from "./liveCapabilities.js";
import {
  bridgeHttpToLiveWsUrl,
  fetchBoundedSnapshot,
  type BoundedSnapshotF04,
} from "./liveSessionHttp.js";
import {
  loadLiveFormPrefs,
  saveLiveBridgeUrl,
  saveLiveFormPrefs,
} from "./liveSessionStorage.js";
import { makeReconcileRecord, type HttpReconcileRecord } from "./liveHttpReconcile.js";
import "./liveSessionShell.css";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) {
    e.className = className;
  }
  if (text !== undefined) {
    e.textContent = text;
  }
  return e;
}

export interface LiveSessionShellHandle {
  disconnect: () => void;
  getModel: () => LiveSessionModelState;
  getLastHttpSnapshot: () => BoundedSnapshotF04 | null;
  getLastCapabilities: () => BridgeCapabilitiesLive | null;
  getLastReconcile: () => HttpReconcileRecord | null;
}

export function mountLiveSessionShell(root: HTMLElement): LiveSessionShellHandle {
  root.innerHTML = "";
  root.classList.add("glass-live-root");

  const banner = el("div", "glass-banner");
  banner.textContent =
    "Glass — live session skeleton (bridge WS + HTTP snapshot). F-IPC provisional. Bearer token is not persisted (sessionStorage keeps URL / session id / delta-wire preference only).";

  const nav = el("div", "glass-live-nav");
  const back = document.createElement("a");
  back.href = "?";
  back.textContent = "← Tier B replay (remove ?live=1)";
  nav.append(back);

  const form = el("section", "glass-live-form");
  const bridgeInput = document.createElement("input");
  bridgeInput.type = "url";
  bridgeInput.placeholder = "http://127.0.0.1:9781";
  bridgeInput.className = "glass-live-input";
  bridgeInput.setAttribute("data-testid", "live-bridge-url");
  const tokenInput = document.createElement("input");
  tokenInput.type = "password";
  tokenInput.placeholder = "Bridge bearer token (not persisted)";
  tokenInput.className = "glass-live-input";
  tokenInput.setAttribute("data-testid", "live-token");
  const sessionInput = document.createElement("input");
  sessionInput.type = "text";
  sessionInput.placeholder = "session_id";
  sessionInput.className = "glass-live-input";
  sessionInput.setAttribute("data-testid", "live-session-id");
  const deltaWire = document.createElement("input");
  deltaWire.type = "checkbox";
  deltaWire.id = "live-delta-wire";
  deltaWire.setAttribute("data-testid", "live-delta-wire");
  const deltaLabel = el("label");
  deltaLabel.htmlFor = "live-delta-wire";
  deltaLabel.textContent = "session_delta_wire (needs bridge + collector + capability)";
  const btnPreflight = el("button", undefined, "Preflight capabilities");
  btnPreflight.type = "button";
  btnPreflight.setAttribute("data-testid", "live-preflight");
  const btnConnect = el("button", undefined, "Connect");
  btnConnect.type = "button";
  btnConnect.setAttribute("data-testid", "live-connect");
  const btnSnapshot = el("button", undefined, "Refresh HTTP snapshot");
  btnSnapshot.type = "button";
  btnSnapshot.setAttribute("data-testid", "live-http-snapshot");
  form.append(
    el("div", "glass-live-field", "Bridge base URL"),
    bridgeInput,
    el("div", "glass-live-field", "Bearer token"),
    tokenInput,
    el("div", "glass-live-field", "Session id"),
    sessionInput,
    deltaWire,
    deltaLabel,
    btnPreflight,
    btnConnect,
    btnSnapshot,
  );

  const prefs = loadLiveFormPrefs();
  if (prefs.bridgeUrl) {
    bridgeInput.value = prefs.bridgeUrl;
  }
  if (prefs.sessionId) {
    sessionInput.value = prefs.sessionId;
  }
  if (prefs.sessionDeltaWire !== undefined) {
    deltaWire.checked = prefs.sessionDeltaWire;
  }

  const status = el("div", "glass-live-status");
  status.setAttribute("data-testid", "live-status");

  const capsPre = el("pre", "glass-live-pre");
  capsPre.setAttribute("data-testid", "live-capabilities");

  const reconcilePre = el("pre", "glass-live-pre");
  reconcilePre.setAttribute("data-testid", "live-reconcile");

  const metaPre = el("pre", "glass-live-pre");
  metaPre.setAttribute("data-testid", "live-meta");

  const eventsPre = el("pre", "glass-live-pre");
  eventsPre.setAttribute("data-testid", "live-events");

  root.append(
    banner,
    nav,
    form,
    el("div", "glass-live-field", "Preflight (GET /capabilities)"),
    capsPre,
    el("div", "glass-live-field", "Last HTTP snapshot reconcile"),
    reconcilePre,
    status,
    el("div", "glass-live-field", "Wire + model JSON"),
    metaPre,
    el("div", "glass-live-field", "events_sample / session_delta tail (debug)"),
    eventsPre,
  );

  let ws: WebSocket | null = null;
  let model = createInitialLiveSessionModelState("");
  let lastHttp: BoundedSnapshotF04 | null = null;
  let lastReconcileProcessed = 0;
  let lastCaps: BridgeCapabilitiesLive | null = null;
  let capsError: string | null = null;
  let lastReconcile: HttpReconcileRecord | null = null;

  function renderCaps(): void {
    capsPre.textContent = capsError
      ? `error: ${capsError}`
      : lastCaps
        ? JSON.stringify(
            {
              collector_fipc_configured: lastCaps.collector_fipc.configured,
              collector_fipc_transport: lastCaps.collector_fipc.transport,
              websocket_path: lastCaps.websocket.path,
              live_session_delta_skeleton: lastCaps.websocket.live_session_delta_skeleton,
              websocket_delta_stream_status: lastCaps.websocket.delta_stream_status,
              session_delta_wire_v0: lastCaps.websocket.session_delta_wire_v0,
              live_session_ingest: lastCaps.live_session_ingest,
              bounded_snapshot_via_http:
                "GET /sessions/:id/snapshot (F-04) when F-IPC configured on bridge",
            },
            null,
            2,
          )
        : "(not fetched — use Preflight with URL + token)";
  }

  function renderReconcile(): void {
    reconcilePre.textContent = lastReconcile
      ? JSON.stringify(lastReconcile, null, 2)
      : "(no HTTP snapshot refresh yet)";
  }

  function setStatus(t: string): void {
    status.textContent = t;
  }

  function renderMeta(): void {
    metaPre.textContent = JSON.stringify(
      {
        sessionId: model.sessionId,
        lastHello: model.lastHello,
        lastReplaced: model.lastReplaced,
        lastResync: model.lastResync,
        lastWarning: model.lastWarning,
        httpReconcileRequested: model.httpReconcileRequested,
        lastDeltaWsSeq: model.lastDeltaWsSeq,
        lastHttpSnapshot: lastHttp
          ? {
              snapshot_cursor: lastHttp.snapshot_cursor,
              bounded_snapshot: lastHttp.bounded_snapshot,
              events_len: lastHttp.events?.length ?? 0,
            }
          : null,
      },
      null,
      2,
    );
  }

  function renderEvents(): void {
    eventsPre.textContent = JSON.stringify(model.eventTail, null, 2);
  }

  function renderAll(): void {
    renderCaps();
    renderReconcile();
    renderMeta();
    renderEvents();
  }

  function disconnect(): void {
    if (ws) {
      ws.close();
      ws = null;
    }
    setStatus("disconnected");
  }

  function persistFormSafe(): void {
    const base = bridgeInput.value.trim();
    const sid = sessionInput.value.trim();
    if (base && sid) {
      saveLiveFormPrefs({
        bridgeUrl: base,
        sessionId: sid,
        sessionDeltaWire: deltaWire.checked,
      });
    } else if (base) {
      saveLiveBridgeUrl(base);
    }
  }

  async function runHttpSnapshot(
    trigger: "operator" | "session_resync_required",
  ): Promise<void> {
    const base = bridgeInput.value.trim();
    const tok = tokenInput.value.trim();
    const sid = sessionInput.value.trim();
    if (!base || !tok || !sid) {
      setStatus("bridge URL, token, and session id required");
      lastReconcile = makeReconcileRecord(trigger, "error", {
        errorMessage: "missing bridge URL, token, or session id",
      });
      renderReconcile();
      return;
    }
    setStatus(
      trigger === "operator"
        ? "fetching HTTP snapshot (operator)…"
        : "fetching HTTP snapshot (after session_resync_required)…",
    );
    try {
      lastHttp = await fetchBoundedSnapshot(base, tok, sid);
      lastReconcile = makeReconcileRecord(trigger, "ok", {
        eventsCount: lastHttp.events?.length ?? 0,
      });
      setStatus(`HTTP snapshot ok — ${lastHttp.events?.length ?? 0} events`);
    } catch (e) {
      lastHttp = null;
      const msg = e instanceof Error ? e.message : String(e);
      lastReconcile = makeReconcileRecord(trigger, "error", {
        errorMessage: msg,
      });
      setStatus(`HTTP snapshot error: ${msg}`);
    }
    persistFormSafe();
    renderAll();
  }

  function onModelUpdated(): void {
    renderAll();
    if (model.httpReconcileRequested > lastReconcileProcessed) {
      lastReconcileProcessed = model.httpReconcileRequested;
      void runHttpSnapshot("session_resync_required");
    }
  }

  btnPreflight.addEventListener("click", () => {
    void (async () => {
      const base = bridgeInput.value.trim();
      const tok = tokenInput.value.trim();
      capsError = null;
      lastCaps = null;
      renderCaps();
      if (!base || !tok) {
        capsError = "bridge URL and bearer token required";
        setStatus("preflight skipped — need URL + token");
        renderCaps();
        return;
      }
      setStatus("preflight: fetching /capabilities…");
      const r = await fetchBridgeCapabilities(base, tok);
      if (!r.ok) {
        capsError = r.error;
        lastCaps = null;
        setStatus(`preflight failed: ${r.error}`);
      } else {
        lastCaps = r.value;
        capsError = null;
        saveLiveBridgeUrl(base);
        setStatus("preflight ok — see capabilities panel");
      }
      renderAll();
    })();
  });

  btnConnect.addEventListener("click", () => {
    disconnect();
    const base = bridgeInput.value.trim();
    const tok = tokenInput.value.trim();
    const sid = sessionInput.value.trim();
    if (!base || !tok || !sid) {
      setStatus("bridge URL, token, and session id required");
      return;
    }
    model = createInitialLiveSessionModelState(sid);
    lastReconcileProcessed = 0;
    lastHttp = null;
    persistFormSafe();
    let url: string;
    try {
      url = bridgeHttpToLiveWsUrl(base, tok);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
      return;
    }
    setStatus("connecting WebSocket…");
    ws = new WebSocket(url);
    ws.addEventListener("open", () => {
      setStatus("connected — subscribing…");
      const socket = ws;
      if (!socket) {
        return;
      }
      const sub: Record<string, unknown> = {
        type: "glass.bridge.live_session.v1",
        msg: "live_session_subscribe",
        protocol: 1,
        session_id: sid,
      };
      if (deltaWire.checked) {
        sub.session_delta_wire = true;
      }
      socket.send(JSON.stringify(sub));
    });
    ws.addEventListener("message", (ev) => {
      const text = typeof ev.data === "string" ? ev.data : "";
      model = applyLiveSessionLine(model, text);
      setStatus("connected — receiving");
      onModelUpdated();
    });
    ws.addEventListener("error", () => {
      setStatus("WebSocket error");
    });
    ws.addEventListener("close", () => {
      setStatus("WebSocket closed");
      ws = null;
    });
    onModelUpdated();
  });

  btnSnapshot.addEventListener("click", () => {
    void runHttpSnapshot("operator");
  });

  setStatus("disconnected");
  renderAll();

  return {
    disconnect,
    getModel: () => model,
    getLastHttpSnapshot: () => lastHttp,
    getLastCapabilities: () => lastCaps,
    getLastReconcile: () => lastReconcile,
  };
}

/**
 * Minimal live-session UI: connect to bridge WebSocket, subscribe, show wire-derived state.
 * No WebGPU; bounded debug surface only.
 */

import {
  applyLiveSessionLine,
  createInitialLiveSessionModelState,
  type LiveSessionModelState,
} from "./applyLiveSessionMessage.js";
import {
  bridgeHttpToLiveWsUrl,
  fetchBoundedSnapshot,
  type BoundedSnapshotF04,
} from "./liveSessionHttp.js";
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
}

export function mountLiveSessionShell(root: HTMLElement): LiveSessionShellHandle {
  root.innerHTML = "";
  root.classList.add("glass-live-root");

  const banner = el("div", "glass-banner");
  banner.textContent =
    "Glass — live session skeleton (bridge WS + HTTP snapshot). F-IPC provisional; not a finished live product.";

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
  tokenInput.placeholder = "Bridge bearer token";
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
  deltaLabel.textContent = "session_delta_wire (needs bridge + collector)";
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
    btnConnect,
    btnSnapshot,
  );

  const status = el("div", "glass-live-status");
  status.setAttribute("data-testid", "live-status");

  const metaPre = el("pre", "glass-live-pre");
  metaPre.setAttribute("data-testid", "live-meta");

  const eventsPre = el("pre", "glass-live-pre");
  eventsPre.setAttribute("data-testid", "live-events");

  root.append(banner, nav, form, status, metaPre, eventsPre);

  let ws: WebSocket | null = null;
  let model = createInitialLiveSessionModelState("");
  let lastHttp: BoundedSnapshotF04 | null = null;
  let lastReconcileProcessed = 0;

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

  function disconnect(): void {
    if (ws) {
      ws.close();
      ws = null;
    }
    setStatus("disconnected");
  }

  async function runHttpSnapshot(): Promise<void> {
    const base = bridgeInput.value.trim();
    const tok = tokenInput.value.trim();
    const sid = sessionInput.value.trim();
    if (!base || !tok || !sid) {
      setStatus("bridge URL, token, and session id required");
      return;
    }
    setStatus("fetching HTTP snapshot…");
    try {
      lastHttp = await fetchBoundedSnapshot(base, tok, sid);
      setStatus(`HTTP snapshot ok — ${lastHttp.events?.length ?? 0} events`);
    } catch (e) {
      lastHttp = null;
      setStatus(`HTTP snapshot error: ${e instanceof Error ? e.message : String(e)}`);
    }
    renderMeta();
  }

  function onModelUpdated(): void {
    renderMeta();
    renderEvents();
    if (model.httpReconcileRequested > lastReconcileProcessed) {
      lastReconcileProcessed = model.httpReconcileRequested;
      void runHttpSnapshot();
    }
  }

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
    void runHttpSnapshot();
  });

  setStatus("disconnected");
  renderMeta();
  renderEvents();

  return {
    disconnect,
    getModel: () => model,
    getLastHttpSnapshot: () => lastHttp,
  };
}

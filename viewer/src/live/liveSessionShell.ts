/**
 * Live-session UI: bridge WebSocket + bounded HTTP snapshot; Scene v0 visual surface (Canvas 2D + optional WebGPU geometry).
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
import {
  buildLiveStatePresentationDoc,
  liveConnectDisabledFromPreflight,
  serializePresentationDoc,
} from "./liveStatePresentation.js";
import {
  buildWsStatusJson,
  formatLastCloseLine,
  formatWsPhaseLine,
  resolveCloseInitiator,
  type WsLastCloseDisplay,
  type WsUiPhase,
} from "./liveWsSessionStatus.js";
import {
  appendLiveSessionLogLine,
  createInitialLiveSessionLogState,
  formatLiveSessionLogHuman,
  LIVE_SESSION_LOG_DEFAULT_MAX_LINES,
  serializeLiveSessionLogForExport,
  summarizeLiveWireForLog,
  truncateForLog,
  type LiveSessionLogSource,
  type LiveSessionLogState,
} from "./liveSessionLog.js";
import {
  formatWebGpuLiveStatusLine,
  hasNavigatorGpu,
  initialWebGpuLiveStatus,
  type WebGpuLiveStatus,
} from "./liveWebGpuProbe.js";
import { formatLiveVisualLegendBlock } from "./liveVisualMarkers.js";
import type { BoundedSceneEmphasisV0 } from "../scene/boundedSceneEmphasis.js";
import { computeBoundedSceneCompare } from "../scene/boundedSceneCompare.js";
import { computeBoundedEvidenceDrilldown } from "../scene/boundedEvidenceDrilldown.js";
import { renderBoundedEvidenceInto } from "../scene/boundedEvidencePanel.js";
import { compileLiveToGlassSceneV0 } from "../scene/compileLiveScene.js";
import { computeBoundedSceneFocus } from "../scene/boundedSceneFocus.js";
import {
  buildBoundedInspectorLines,
  buildBoundedSelectionHitTargetsForScene,
  hitTestBoundedSelection,
} from "../scene/boundedSceneSelection.js";
import { GLASS_SCENE_V0, type GlassSceneV0 } from "../scene/glassSceneV0.js";
import { liveVisualSpecFromScene } from "../scene/sceneToLiveVisualSpec.js";
import type { LiveVisualSpec } from "./liveVisualModel.js";
import {
  buildLiveVisualProvenanceStrip,
  formatLiveVisualProvenanceStripText,
  GLASS_LIVE_VISUAL_PROVENANCE_V0,
  LIVE_VISUAL_PROVENANCE_STRIP_HONESTY,
  serializeLiveVisualProvenanceStrip,
} from "./liveVisualProvenance.js";
import { paintLiveVisualSurface, type PaintLiveVisualSurfaceResult } from "./liveVisualRenderer.js";
import type { LiveVisualWebGpuBundle } from "./liveVisualWebGpu.js";
import { tryInitWebGpuCanvas } from "./liveVisualWebGpu.js";
import {
  VERTICAL_SLICE_SCENARIO_BODY,
  VERTICAL_SLICE_SCENARIO_LABEL,
  VERTICAL_SLICE_SCENARIO_TITLE,
  liveHeroSubtitle,
} from "../app/verticalSliceV0.js";
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

function copyButton(
  label: string,
  getText: () => string,
  onStatus: (t: string) => void,
): HTMLButtonElement {
  const b = el("button", "glass-live-copy", "Copy JSON");
  b.type = "button";
  b.addEventListener("click", () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(getText());
        onStatus(`copied ${label}`);
      } catch {
        onStatus(`copy failed (${label})`);
      }
    })();
  });
  return b;
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

  const hero = el("section", "glass-vs-hero glass-live-vs-hero");
  hero.setAttribute("data-testid", "live-vs-hero");
  hero.append(
    el("h1", "glass-vs-title", "Glass — Vertical Slice v0"),
    el("p", "glass-vs-badge", "Live path · ?live=1"),
    el("p", "glass-vs-scenario-kicker", `${VERTICAL_SLICE_SCENARIO_TITLE} · live`),
    el("p", "glass-vs-nickname", VERTICAL_SLICE_SCENARIO_LABEL),
    el("p", "glass-vs-subtitle", liveHeroSubtitle()),
    el("p", "glass-vs-scenario", VERTICAL_SLICE_SCENARIO_BODY),
    el(
      "p",
      "glass-live-tech-note",
      "Bridge WebSocket + bounded HTTP snapshot (F-04). F-IPC transport provisional. Bearer token not persisted (sessionStorage: URL, session id, delta-wire preference).",
    ),
  );

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
  const btnDisconnect = el("button", undefined, "Disconnect");
  btnDisconnect.type = "button";
  btnDisconnect.setAttribute("data-testid", "live-disconnect");
  btnDisconnect.disabled = true;
  const connectHint = el("span", "glass-live-connect-hint");
  connectHint.setAttribute("data-testid", "live-connect-hint");
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
    btnDisconnect,
    connectHint,
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

  let activeWs: WebSocket | null = null;
  const closeAttribution = new WeakMap<WebSocket, "operator" | "reconnect">();
  const errorSeenOnSocket = new WeakMap<WebSocket, boolean>();

  let wsUiPhase: WsUiPhase = "idle";
  let lastWsCloseDisplay: WsLastCloseDisplay | null = null;
  let hadErrorEventOnActiveSocket = false;

  let model = createInitialLiveSessionModelState("");
  let lastHttp: BoundedSnapshotF04 | null = null;
  let lastReconcileProcessed = 0;
  let lastCaps: BridgeCapabilitiesLive | null = null;
  let capsError: string | null = null;
  let lastReconcile: HttpReconcileRecord | null = null;

  let logState: LiveSessionLogState = createInitialLiveSessionLogState(
    LIVE_SESSION_LOG_DEFAULT_MAX_LINES,
  );

  const connectionStatus = el("div", "glass-live-connection-status");
  connectionStatus.setAttribute("data-testid", "live-connection-status");

  const ephemeralStatus = el("div", "glass-live-status");
  ephemeralStatus.setAttribute("data-testid", "live-status");

  function setEphemeralStatus(t: string): void {
    ephemeralStatus.textContent = t;
  }

  const logSectionIntro = el("div", "glass-live-field glass-live-log-intro");
  logSectionIntro.setAttribute("data-testid", "live-log-intro");
  logSectionIntro.textContent =
    "Bounded in-memory live session log (oldest dropped over cap) — not a durable audit trail; no token values logged.";

  const logPre = el("pre", "glass-live-pre glass-live-log-pre");
  logPre.setAttribute("data-testid", "live-session-log");

  const logHeader = el("div", "glass-live-panel-header");
  logHeader.append(
    el("span", "glass-live-field", "Live session log (operator)"),
    copyButton("session log", () => serializeLiveSessionLogForExport(logState), setEphemeralStatus),
  );

  function renderLiveLogStrip(): void {
    logPre.textContent = formatLiveSessionLogHuman(logState);
  }

  function pushLiveLog(
    source: LiveSessionLogSource,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    logState = appendLiveSessionLogLine(
      logState,
      meta ? { source, message, meta } : { source, message },
      Date.now(),
    );
    renderLiveLogStrip();
  }

  const wsStatusHeader = el("div", "glass-live-panel-header");
  wsStatusHeader.append(
    el("span", "glass-live-field", "WebSocket session / close (debug)"),
    copyButton("ws status", () => {
      return buildWsStatusJson({
        phase: wsUiPhase,
        lastClose: lastWsCloseDisplay,
        hadUnhandledErrorEvent:
          hadErrorEventOnActiveSocket && (wsUiPhase === "open" || wsUiPhase === "connecting"),
      });
    }, setEphemeralStatus),
  );
  const wsStatusPre = el("pre", "glass-live-pre glass-live-pre--compact");
  wsStatusPre.setAttribute("data-testid", "live-ws-status");

  function updateWsSessionPanel(): void {
    if (wsUiPhase === "idle" && lastWsCloseDisplay) {
      connectionStatus.textContent = formatLastCloseLine(lastWsCloseDisplay);
    } else {
      connectionStatus.textContent = formatWsPhaseLine(wsUiPhase);
    }
    wsStatusPre.textContent = buildWsStatusJson({
      phase: wsUiPhase,
      lastClose: lastWsCloseDisplay,
      hadUnhandledErrorEvent:
        hadErrorEventOnActiveSocket && (wsUiPhase === "open" || wsUiPhase === "connecting"),
    });
    btnDisconnect.disabled = activeWs === null;
  }

  const statePanel = el("section", "glass-live-state-panel");
  statePanel.setAttribute("data-testid", "live-state-panel");

  const capsHeader = el("div", "glass-live-panel-header");
  capsHeader.append(
    el("span", "glass-live-field", "Preflight (GET /capabilities)"),
    copyButton("capabilities", () => capsPre.textContent ?? "", setEphemeralStatus),
  );
  const capsPre = el("pre", "glass-live-pre");
  capsPre.setAttribute("data-testid", "live-capabilities");

  const reconcileHeader = el("div", "glass-live-panel-header");
  reconcileHeader.append(
    el("span", "glass-live-field", "Last HTTP snapshot reconcile (F-04)"),
    copyButton("reconcile", () => reconcilePre.textContent ?? "", setEphemeralStatus),
  );
  const reconcilePre = el("pre", "glass-live-pre");
  reconcilePre.setAttribute("data-testid", "live-reconcile");

  const presentationHeader = el("div", "glass-live-panel-header");
  presentationHeader.append(
    el("span", "glass-live-field", "Live state summary (JSON)"),
    copyButton("live state", () => {
      return serializePresentationDoc(
        buildLiveStatePresentationDoc(model, lastReconcile, lastHttp),
      );
    }, setEphemeralStatus),
  );

  const presentationPre = el("pre", "glass-live-pre glass-live-pre--compact");
  presentationPre.setAttribute("data-testid", "live-presentation-json");

  const metaHeader = el("div", "glass-live-panel-header");
  metaHeader.append(
    el("span", "glass-live-field", "Wire + full model JSON (debug)"),
    copyButton("model", () => metaPre.textContent ?? "", setEphemeralStatus),
  );
  const metaPre = el("pre", "glass-live-pre");
  metaPre.setAttribute("data-testid", "live-meta");

  const tailOrigin = el("div", "glass-live-tail-origin");
  tailOrigin.setAttribute("data-testid", "live-tail-origin");

  const eventHonesty = el("p", "glass-live-event-honesty");
  eventHonesty.setAttribute("data-testid", "live-event-honesty");

  const visualSurface = el("section", "glass-live-visual-surface");
  visualSurface.setAttribute("data-testid", "live-visual-surface");
  visualSurface.setAttribute("aria-labelledby", "live-visual-surface-title");
  visualSurface.setAttribute("aria-describedby", "live-visual-legend live-visual-provenance-strip");
  const visualIntro = el(
    "div",
    "glass-live-field",
    "Vertical Slice v0 — same Drawable Primitives + Scene v0 strip as replay: Canvas 2D and/or WebGPU quads + Canvas text overlay (not topology)",
  );
  visualIntro.setAttribute("id", "live-visual-surface-title");
  const visualGpuStatus = el("p", "glass-live-visual-gpu-status");
  visualGpuStatus.setAttribute("data-testid", "live-visual-gpu-status");
  let webGpuStatus: WebGpuLiveStatus = initialWebGpuLiveStatus(navigator);
  visualGpuStatus.textContent = formatWebGpuLiveStatusLine(webGpuStatus);
  const visualCanvasStack = el("div", "glass-live-visual-canvas-stack");
  const visualCanvas = document.createElement("canvas");
  visualCanvas.className = "glass-live-visual-canvas";
  visualCanvas.setAttribute("data-testid", "live-visual-canvas");
  const visualCanvasWebGpu = document.createElement("canvas");
  visualCanvasWebGpu.className = "glass-live-visual-canvas glass-live-visual-canvas--webgpu";
  visualCanvasWebGpu.setAttribute("data-testid", "live-visual-canvas-webgpu");
  visualCanvasWebGpu.hidden = true;
  const visualCanvasTextOverlay = document.createElement("canvas");
  visualCanvasTextOverlay.className =
    "glass-live-visual-canvas glass-live-visual-canvas--text-overlay";
  visualCanvasTextOverlay.setAttribute("data-testid", "live-visual-canvas-text-overlay");
  visualCanvasTextOverlay.hidden = true;
  visualCanvasStack.setAttribute("data-scene", GLASS_SCENE_V0);
  visualCanvasStack.classList.add("glass-live-visual-hit-target");
  visualCanvasStack.append(visualCanvas, visualCanvasWebGpu, visualCanvasTextOverlay);

  const visualFallback = el("p", "glass-live-visual-fallback");
  visualFallback.setAttribute("data-testid", "live-visual-fallback");
  visualFallback.textContent =
    "Canvas 2D context unavailable — textual panels above remain authoritative for this session.";
  visualFallback.hidden = true;
  const visualProvenanceHeader = el("div", "glass-live-panel-header glass-live-visual-provenance-header");
  const visualProvenanceCopyJson = el("button", "glass-live-copy", "Copy JSON");
  visualProvenanceCopyJson.type = "button";
  visualProvenanceCopyJson.setAttribute("data-testid", "live-visual-provenance-copy-json");
  const visualProvenanceCopyText = el("button", "glass-live-copy", "Copy text");
  visualProvenanceCopyText.type = "button";
  visualProvenanceCopyText.setAttribute("data-testid", "live-visual-provenance-copy-text");
  visualProvenanceHeader.append(
    el("span", "glass-live-field", "Live visual provenance (bounded)"),
    visualProvenanceCopyJson,
    visualProvenanceCopyText,
  );
  const visualProvenanceStrip = el("pre", "glass-live-visual-provenance");
  visualProvenanceStrip.setAttribute("data-testid", "live-visual-provenance-strip");
  visualProvenanceStrip.setAttribute("id", "live-visual-provenance-strip");
  visualProvenanceStrip.setAttribute("title", LIVE_VISUAL_PROVENANCE_STRIP_HONESTY);
  const visualLegend = el("p", "glass-live-visual-legend");
  visualLegend.setAttribute("data-testid", "live-visual-legend");
  visualLegend.setAttribute("id", "live-visual-legend");
  visualLegend.textContent = formatLiveVisualLegendBlock();
  const boundedInspectorTitle = el(
    "h4",
    "glass-bounded-inspector-title",
    "Bounded scene selection (Vertical Slice v7)",
  );
  const boundedInspectorPre = el("pre", "glass-bounded-inspector");
  boundedInspectorPre.setAttribute("data-testid", "live-bounded-inspector");
  const boundedEvidenceTitle = el(
    "h4",
    "glass-bounded-evidence-heading",
    "Bounded evidence (Vertical Slice v9)",
  );
  const boundedEvidenceRoot = el("div", "glass-bounded-evidence-root");
  boundedEvidenceRoot.setAttribute("data-testid", "live-bounded-evidence");
  visualCanvas.setAttribute("aria-describedby", "live-visual-legend live-visual-provenance-strip");
  visualCanvasWebGpu.setAttribute("aria-describedby", "live-visual-legend live-visual-provenance-strip");
  visualCanvasTextOverlay.setAttribute("aria-describedby", "live-visual-legend live-visual-provenance-strip");
  visualSurface.append(
    visualIntro,
    visualGpuStatus,
    visualCanvasStack,
    visualFallback,
    boundedInspectorTitle,
    boundedInspectorPre,
    boundedEvidenceTitle,
    boundedEvidenceRoot,
    visualProvenanceHeader,
    visualProvenanceStrip,
    visualLegend,
  );

  let webGpuBundle: LiveVisualWebGpuBundle | null = null;
  let lastPaintResult: PaintLiveVisualSurfaceResult | null = null;
  let lastPaintedLiveScene: GlassSceneV0 | null = null;
  /** Bounded frame before the latest live paint — honest compare baseline. */
  let previousPaintedLiveScene: GlassSceneV0 | null = null;
  let lastLiveEmphasis: BoundedSceneEmphasisV0 | null = null;
  let selectedBoundedSelectionId: string | null = null;

  function refreshBoundedInspectorLive(): void {
    if (!lastPaintedLiveScene) {
      boundedInspectorPre.textContent = "";
      boundedInspectorPre.removeAttribute("data-selected");
      boundedEvidenceRoot.replaceChildren();
      return;
    }
    const spec = liveVisualSpecFromScene(lastPaintedLiveScene, selectedBoundedSelectionId, {
      previousScene: previousPaintedLiveScene,
    });
    boundedInspectorPre.textContent = buildBoundedInspectorLines(
      lastPaintedLiveScene,
      spec,
      selectedBoundedSelectionId,
    ).join("\n");
    if (selectedBoundedSelectionId) {
      boundedInspectorPre.dataset.selected = "true";
    } else {
      boundedInspectorPre.removeAttribute("data-selected");
    }
    const cmp = computeBoundedSceneCompare(previousPaintedLiveScene, lastPaintedLiveScene, {
      selectedId: selectedBoundedSelectionId,
    });
    const drill = computeBoundedEvidenceDrilldown({
      scene: lastPaintedLiveScene,
      spec,
      compare: cmp,
      selectedSelectionId: selectedBoundedSelectionId,
      previousBoundedSampleCount: previousPaintedLiveScene?.boundedSampleCount ?? null,
      liveEventTail: model.eventTail,
      replay: null,
    });
    renderBoundedEvidenceInto(boundedEvidenceRoot, drill);
  }

  function buildCurrentLiveVisualSpec(): LiveVisualSpec {
    if (lastPaintedLiveScene) {
      return liveVisualSpecFromScene(lastPaintedLiveScene, selectedBoundedSelectionId, {
        previousScene: previousPaintedLiveScene,
      });
    }
    return liveVisualSpecFromScene(
      compileLiveToGlassSceneV0({
        model,
        lastReconcile,
        httpSnapshotOrigin: lastHttp?.bounded_snapshot?.snapshot_origin ?? null,
      }),
      selectedBoundedSelectionId,
      { previousScene: null },
    );
  }

  function buildCurrentProvenanceStrip() {
    const spec = buildCurrentLiveVisualSpec();
    const boundedFocusSummary =
      lastPaintedLiveScene !== null
        ? (() => {
            const fp = computeBoundedSceneFocus(lastPaintedLiveScene, selectedBoundedSelectionId)
              .provenanceFocusLine;
            const rf = spec.boundedStripReflowLine;
            if (fp && rf) {
              return `${fp} · ${rf}`;
            }
            return rf ?? fp ?? null;
          })()
        : null;
    return buildLiveVisualProvenanceStrip({
      webGpuProbeStatus: webGpuStatus,
      webGpuBundlePresent: webGpuBundle !== null,
      lastPaint: lastPaintResult,
      visualSpec: spec,
      lastHttp,
      lastReconcile,
      deltaWireCheckbox: deltaWire.checked,
      sessionDeltaWireV0FromCaps: lastCaps?.websocket.session_delta_wire_v0,
      boundedFocusSummary,
    });
  }

  function refreshVisualProvenanceStrip(): void {
    visualProvenanceStrip.textContent = formatLiveVisualProvenanceStripText(buildCurrentProvenanceStrip());
  }

  function updateWebGpuStatusDisplay(): void {
    visualGpuStatus.textContent = formatWebGpuLiveStatusLine(webGpuStatus);
    refreshVisualProvenanceStrip();
  }

  void (async () => {
    if (!hasNavigatorGpu(navigator)) {
      webGpuStatus = "unavailable";
      updateWebGpuStatusDisplay();
      return;
    }
    webGpuStatus = "available_but_not_initialized";
    updateWebGpuStatusDisplay();
    const b = await tryInitWebGpuCanvas(visualCanvasWebGpu, navigator);
    if (!b) {
      webGpuStatus = "failed_with_fallback";
      updateWebGpuStatusDisplay();
      void paintLiveVisual();
      return;
    }
    webGpuBundle = b;
    webGpuStatus = "initialized";
    updateWebGpuStatusDisplay();
    void paintLiveVisual();
  })();

  const eventList = el("div", "glass-live-event-list");
  eventList.setAttribute("data-testid", "live-event-list");
  eventList.setAttribute("data-live-events", "bounded-tail");

  const eventsHeader = el("div", "glass-live-panel-header");
  eventsHeader.append(
    el("span", "glass-live-field", "Bounded WS event tail (debug)"),
    copyButton("event tail", () => JSON.stringify(model.eventTail, null, 2), setEphemeralStatus),
  );
  const eventsPre = el("pre", "glass-live-pre glass-live-pre--hidden");
  eventsPre.setAttribute("data-testid", "live-events");
  eventsPre.setAttribute("aria-hidden", "true");

  statePanel.append(
    el("h2", "glass-live-state-heading", "Live state (operator)"),
    presentationHeader,
    presentationPre,
    tailOrigin,
    eventHonesty,
    visualSurface,
    eventList,
    eventsHeader,
    eventsPre,
  );

  root.append(
    hero,
    nav,
    form,
    statePanel,
    capsHeader,
    capsPre,
    reconcileHeader,
    reconcilePre,
    logSectionIntro,
    logHeader,
    logPre,
    el("div", "glass-live-field", "WebSocket connection"),
    connectionStatus,
    wsStatusHeader,
    wsStatusPre,
    el("div", "glass-live-field", "Activity (preflight / HTTP / clipboard)"),
    ephemeralStatus,
    metaHeader,
    metaPre,
  );

  function syncConnectGate(): void {
    const g = liveConnectDisabledFromPreflight(capsError, lastCaps);
    btnConnect.disabled = g.disabled;
    connectHint.textContent = g.reason;
  }

  function renderStatePresentation(): void {
    const doc = buildLiveStatePresentationDoc(model, lastReconcile, lastHttp);
    presentationPre.textContent = serializePresentationDoc(doc);

    tailOrigin.innerHTML = "";
    const w = model.lastAppliedWire;
    if (w) {
      const badge = el("span", `glass-live-badge glass-live-badge--${w.eventTailMutation}`);
      badge.setAttribute("data-testid", "live-tail-mutation-badge");
      badge.textContent = `${w.msg} · ${w.eventTailMutation}`;
      const sum = el("span", "glass-live-tail-summary");
      sum.textContent = w.summary;
      sum.setAttribute("data-testid", "live-tail-summary");
      tailOrigin.append(badge, sum);
    } else {
      tailOrigin.textContent = "No wire messages applied yet.";
    }

    eventHonesty.textContent = [
      doc.boundedSampleHonesty,
      "WS tail order: oldest at top → newest at bottom (bridge order).",
      "HTTP snapshot events are listed in reconcile/meta — not merged into this WS tail.",
    ].join(" ");

    eventList.innerHTML = "";
    if (model.eventTail.length === 0) {
      const empty = el("p", "glass-live-event-empty");
      empty.setAttribute("data-testid", "live-event-empty");
      empty.textContent = "(no events in bounded WS tail yet)";
      eventList.append(empty);
    } else {
      model.eventTail.forEach((ev, i) => {
        const row = el("div", "glass-live-event-row");
        const idx = el("span", "glass-live-event-idx", String(i + 1));
        const pre = el("pre", "glass-live-event-json");
        pre.textContent = JSON.stringify(ev, null, 2);
        row.append(idx, pre);
        eventList.append(row);
      });
    }

    eventsPre.textContent = JSON.stringify(model.eventTail, null, 2);

    void paintLiveVisual();
  }

  async function paintLiveVisual(): Promise<void> {
    const prev = lastPaintedLiveScene;
    const scene = compileLiveToGlassSceneV0({
      model,
      lastReconcile,
      httpSnapshotOrigin: lastHttp?.bounded_snapshot?.snapshot_origin ?? null,
      previousEmphasis: lastLiveEmphasis,
    });
    lastLiveEmphasis = scene.emphasis;
    lastPaintedLiveScene = scene;
    previousPaintedLiveScene = prev;
    const result = await paintLiveVisualSurface(
      visualCanvas,
      visualCanvasWebGpu,
      visualCanvasTextOverlay,
      scene,
      undefined,
      webGpuBundle,
      { selectedSelectionId: selectedBoundedSelectionId, previousScene: prev },
    );
    lastPaintResult = result;
    visualFallback.hidden = result.fallbackTextShouldHide;
    visualLegend.textContent = formatLiveVisualLegendBlock();
    refreshVisualProvenanceStrip();
    refreshBoundedInspectorLive();
  }

  visualCanvasStack.addEventListener("pointerdown", (ev) => {
    const scene = lastPaintedLiveScene;
    if (!scene) {
      return;
    }
    const rect = visualCanvasStack.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const lay = { widthCss: scene.bounds.widthCss, heightCss: scene.bounds.heightCss };
    const targets = buildBoundedSelectionHitTargetsForScene(scene, lay, selectedBoundedSelectionId, {
      previousScene: previousPaintedLiveScene,
    });
    const id = hitTestBoundedSelection(x, y, targets);
    if (id === selectedBoundedSelectionId) {
      selectedBoundedSelectionId = null;
    } else {
      selectedBoundedSelectionId = id;
    }
    void paintLiveVisual();
  });

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
    refreshVisualProvenanceStrip();
  }

  function renderReconcile(): void {
    reconcilePre.textContent = lastReconcile
      ? JSON.stringify(lastReconcile, null, 2)
      : "(no HTTP snapshot refresh yet)";
    refreshVisualProvenanceStrip();
  }

  function renderMeta(): void {
    metaPre.textContent = JSON.stringify(
      {
        sessionId: model.sessionId,
        lastHello: model.lastHello,
        lastReplaced: model.lastReplaced,
        lastResync: model.lastResync,
        lastWarning: model.lastWarning,
        lastAppliedWire: model.lastAppliedWire,
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

  function renderAll(): void {
    syncConnectGate();
    renderCaps();
    renderReconcile();
    renderStatePresentation();
    renderMeta();
    updateWsSessionPanel();
    renderLiveLogStrip();
  }

  function closeActiveSocket(attribution: "operator" | "reconnect"): void {
    if (!activeWs) {
      return;
    }
    const s = activeWs;
    closeAttribution.set(s, attribution);
    s.close();
  }

  function disconnectOperator(): void {
    if (!activeWs) {
      return;
    }
    pushLiveLog("operator", "Disconnect requested (closing WebSocket)", { action: "disconnect" });
    setEphemeralStatus("disconnect — closing WebSocket (operator)");
    closeActiveSocket("operator");
    updateWsSessionPanel();
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
      pushLiveLog("http", "HTTP snapshot skipped: missing URL, token, or session_id", {
        trigger,
        outcome: "skipped",
      });
      setEphemeralStatus("bridge URL, token, and session id required");
      lastReconcile = makeReconcileRecord(trigger, "error", {
        errorMessage: "missing bridge URL, token, or session id",
      });
      renderReconcile();
      return;
    }
    pushLiveLog("http", `HTTP snapshot start trigger=${trigger}`, { trigger });
    setEphemeralStatus(
      trigger === "operator"
        ? "fetching HTTP snapshot (operator Refresh)…"
        : "fetching HTTP snapshot (automatic after session_resync_required)…",
    );
    try {
      lastHttp = await fetchBoundedSnapshot(base, tok, sid);
      lastReconcile = makeReconcileRecord(trigger, "ok", {
        eventsCount: lastHttp.events?.length ?? 0,
      });
      const trig =
        trigger === "operator"
          ? "operator Refresh"
          : "session_resync_required → reconcile";
      pushLiveLog(
        "http",
        `HTTP snapshot ok (${trig}) events_in_body=${lastHttp.events?.length ?? 0}`,
        {
          trigger,
          outcome: "ok",
          eventsCount: lastHttp.events?.length ?? 0,
          snapshot_cursor: lastHttp.snapshot_cursor,
        },
      );
      setEphemeralStatus(
        `HTTP snapshot ok (${trig}) — ${lastHttp.events?.length ?? 0} events in response body`,
      );
    } catch (e) {
      lastHttp = null;
      const msg = e instanceof Error ? e.message : String(e);
      lastReconcile = makeReconcileRecord(trigger, "error", {
        errorMessage: msg,
      });
      pushLiveLog("http", `HTTP snapshot error trigger=${trigger}`, {
        trigger,
        outcome: "error",
        detail: truncateForLog(msg, 240),
      });
      setEphemeralStatus(`HTTP snapshot error: ${msg}`);
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
      syncConnectGate();
      if (!base || !tok) {
        capsError = "bridge URL and bearer token required";
        pushLiveLog("preflight", "preflight skipped: need URL and token", { outcome: "skipped" });
        setEphemeralStatus("preflight skipped — need URL + token");
        renderCaps();
        return;
      }
      pushLiveLog("preflight", "preflight: GET /capabilities started", { path: "/capabilities" });
      setEphemeralStatus("preflight: fetching /capabilities…");
      const r = await fetchBridgeCapabilities(base, tok);
      if (!r.ok) {
        capsError = r.error;
        lastCaps = null;
        pushLiveLog("preflight", `preflight failed: ${truncateForLog(r.error, 200)}`, {
          outcome: "error",
        });
        setEphemeralStatus(`preflight failed: ${r.error}`);
      } else {
        lastCaps = r.value;
        capsError = null;
        saveLiveBridgeUrl(base);
        pushLiveLog(
          "preflight",
          `preflight ok collector_fipc.configured=${lastCaps.collector_fipc.configured}`,
          {
            outcome: "ok",
            collector_fipc_configured: lastCaps.collector_fipc.configured,
            live_session_ingest: lastCaps.live_session_ingest,
          },
        );
        setEphemeralStatus("preflight ok — see capabilities panel");
      }
      renderAll();
    })();
  });

  btnConnect.addEventListener("click", () => {
    if (btnConnect.disabled) {
      return;
    }
    closeActiveSocket("reconnect");
    lastWsCloseDisplay = null;
    const base = bridgeInput.value.trim();
    const tok = tokenInput.value.trim();
    const sid = sessionInput.value.trim();
    if (!base || !tok || !sid) {
      pushLiveLog("operator", "Connect skipped: need URL, token, and session_id", {
        outcome: "skipped",
      });
      setEphemeralStatus("bridge URL, token, and session id required");
      wsUiPhase = "idle";
      updateWsSessionPanel();
      return;
    }
    pushLiveLog("operator", `Connect: starting WebSocket for session_id=${truncateForLog(sid, 80)}`, {
      session_id: sid,
    });
    model = createInitialLiveSessionModelState(sid);
    lastReconcileProcessed = 0;
    lastHttp = null;
    hadErrorEventOnActiveSocket = false;
    persistFormSafe();
    let url: string;
    try {
      url = bridgeHttpToLiveWsUrl(base, tok);
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      pushLiveLog("operator", `Connect: WebSocket URL error ${truncateForLog(m, 160)}`, {
        outcome: "error",
      });
      setEphemeralStatus(m);
      wsUiPhase = "idle";
      updateWsSessionPanel();
      return;
    }
    wsUiPhase = "connecting";
    pushLiveLog("ws", "WebSocket: connecting (constructor)", { phase: "connecting" });
    setEphemeralStatus("opening WebSocket…");
    updateWsSessionPanel();

    const sock = new WebSocket(url);
    activeWs = sock;
    updateWsSessionPanel();

    sock.addEventListener("open", () => {
      if (sock !== activeWs) {
        return;
      }
      hadErrorEventOnActiveSocket = false;
      wsUiPhase = "open";
      pushLiveLog("ws", "WebSocket open — sending live_session_subscribe", { phase: "open" });
      updateWsSessionPanel();
      setEphemeralStatus("subscribing (live_session_subscribe sent)…");
      const sub: Record<string, unknown> = {
        type: "glass.bridge.live_session.v1",
        msg: "live_session_subscribe",
        protocol: 1,
        session_id: sid,
      };
      if (deltaWire.checked) {
        sub.session_delta_wire = true;
      }
      sock.send(JSON.stringify(sub));
    });
    sock.addEventListener("message", (ev) => {
      if (sock !== activeWs) {
        return;
      }
      const text = typeof ev.data === "string" ? ev.data : "";
      const wireSummary = summarizeLiveWireForLog(text);
      if (wireSummary) {
        pushLiveLog("ws", wireSummary.message, wireSummary.meta);
      } else {
        pushLiveLog("ws", "non-live_session WS text line (ignored by reducer)", {
          ignored: true,
          len: text.length,
        });
      }
      model = applyLiveSessionLine(model, text);
      setEphemeralStatus("receiving live_session wire (see bounded tail below)");
      onModelUpdated();
    });
    sock.addEventListener("error", () => {
      if (sock !== activeWs) {
        return;
      }
      errorSeenOnSocket.set(sock, true);
      hadErrorEventOnActiveSocket = true;
      pushLiveLog(
        "ws",
        "WebSocket error event (browser) — await close for code/reason",
        {},
      );
      setEphemeralStatus(
        "WebSocket error event — close code/reason will appear when the socket closes",
      );
      updateWsSessionPanel();
    });
    sock.addEventListener("close", (ev) => {
      if (ev.target !== activeWs) {
        return;
      }
      const e = ev as CloseEvent;
      const s = activeWs;
      activeWs = null;
      const attr = s ? closeAttribution.get(s) ?? null : null;
      if (s) {
        closeAttribution.delete(s);
      }
      const hadErr = s ? errorSeenOnSocket.get(s) ?? false : false;
      if (s) {
        errorSeenOnSocket.delete(s);
      }
      hadErrorEventOnActiveSocket = false;

      wsUiPhase = "idle";
      if (attr === "reconnect") {
        lastWsCloseDisplay = null;
        updateWsSessionPanel();
        return;
      }
      const attributionForInit =
        attr === "operator" ? "operator" : null;
      lastWsCloseDisplay = {
        initiator: resolveCloseInitiator(attributionForInit, hadErr),
        code: e.code,
        reason: e.reason ?? "",
        wasClean: e.wasClean,
      };
      pushLiveLog(
        "ws",
        `WebSocket closed code=${e.code} wasClean=${e.wasClean} initiator=${lastWsCloseDisplay.initiator}`,
        {
          code: e.code,
          reason: truncateForLog(e.reason ?? "", 200),
          wasClean: e.wasClean,
          initiator: lastWsCloseDisplay.initiator,
          operator_close: attr === "operator",
        },
      );
      if (attr === "operator") {
        setEphemeralStatus("WebSocket closed (operator disconnect)");
      } else {
        setEphemeralStatus("WebSocket closed — see connection line for code/reason");
      }
      updateWsSessionPanel();
    });
    onModelUpdated();
  });

  btnDisconnect.addEventListener("click", () => {
    if (btnDisconnect.disabled) {
      return;
    }
    disconnectOperator();
  });

  btnSnapshot.addEventListener("click", () => {
    void runHttpSnapshot("operator");
  });

  deltaWire.addEventListener("change", () => {
    persistFormSafe();
    refreshVisualProvenanceStrip();
  });

  visualProvenanceCopyJson.addEventListener("click", () => {
    void (async () => {
      const { jsonPretty } = serializeLiveVisualProvenanceStrip(buildCurrentProvenanceStrip());
      try {
        await navigator.clipboard.writeText(jsonPretty);
        pushLiveLog("operator", "provenance copied to clipboard (JSON v0)", {
          action: "provenance_copy",
          format: "json",
          kind: GLASS_LIVE_VISUAL_PROVENANCE_V0,
        });
        setEphemeralStatus("copied live visual provenance JSON");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        pushLiveLog("operator", `provenance copy failed: ${truncateForLog(msg, 120)}`, {
          action: "provenance_copy",
          outcome: "error",
          format: "json",
        });
        setEphemeralStatus(`provenance copy failed (${msg})`);
      }
    })();
  });

  visualProvenanceCopyText.addEventListener("click", () => {
    void (async () => {
      const { plainText } = serializeLiveVisualProvenanceStrip(buildCurrentProvenanceStrip());
      try {
        await navigator.clipboard.writeText(plainText);
        pushLiveLog("operator", "provenance copied to clipboard (plain text)", {
          action: "provenance_copy",
          format: "plainText",
          kind: GLASS_LIVE_VISUAL_PROVENANCE_V0,
        });
        setEphemeralStatus("copied live visual provenance (text)");
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        pushLiveLog("operator", `provenance copy failed: ${truncateForLog(msg, 120)}`, {
          action: "provenance_copy",
          outcome: "error",
          format: "plainText",
        });
        setEphemeralStatus(`provenance copy failed (${msg})`);
      }
    })();
  });

  setEphemeralStatus("");
  wsUiPhase = "idle";
  lastWsCloseDisplay = null;
  pushLiveLog(
    "operator",
    "Live shell ready — bounded session log strip active (see note above log)",
    { strip_version: "v0", max_lines: LIVE_SESSION_LOG_DEFAULT_MAX_LINES },
  );
  renderAll();

  return {
    disconnect: () => disconnectOperator(),
    getModel: () => model,
    getLastHttpSnapshot: () => lastHttp,
    getLastCapabilities: () => lastCaps,
    getLastReconcile: () => lastReconcile,
  };
}

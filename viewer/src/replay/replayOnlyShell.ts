import { getBuildMode } from "../app/mode.js";
import { loadGlassPack } from "../pack/loadPack.js";
import { attachPackDropHandlers, wirePackFileInput } from "./dragDrop.js";
import { renderLiveVisualOnCanvas } from "../live/liveVisualCanvas.js";
import { GLASS_SCENE_V0 } from "../scene/glassSceneV0.js";
import { compileReplayToGlassSceneV0 } from "../scene/compileReplayScene.js";
import {
  currentEvent,
  cursorFraction,
  entityRefsForEvent,
  initialReplayState,
  reduceReplay,
  type ReplayAction,
  type ReplayState,
} from "./replayModel.js";
import "./replayShell.css";

/** UX pacing only — not a spec freeze; Tier B uses index-based playback. */
const PLAY_INTERVAL_MS = 400;

let loadGeneration = 0;

export interface ReplayShellHandle {
  getState: () => ReplayState;
  dispatch: (a: ReplayAction) => void;
}

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

export function mountReplayShell(root: HTMLElement): ReplayShellHandle {
  const mode = getBuildMode();
  root.innerHTML = "";
  root.classList.add("glass-replay-root");

  let state = initialReplayState();
  let playTimer: ReturnType<typeof setInterval> | null = null;

  const banner = el("div", "glass-banner");
  banner.textContent =
    mode === "static_replay"
      ? "Glass — static replay (Tier B). Replay-only build: no live capture, no bridge."
      : "Glass";

  const liveNav = el("div", "glass-live-nav");
  const liveA = document.createElement("a");
  liveA.href = "?live=1";
  liveA.setAttribute("data-testid", "replay-link-live-session");
  liveA.textContent =
    "Open live session skeleton (bridge WebSocket + HTTP) — ?live=1";
  liveNav.append(liveA);

  const dropZone = el("div", "glass-drop-zone");
  dropZone.textContent =
    "Drop a .glass_pack here, or use Open file. Tier B: manifest.json plus events.jsonl (glass.pack.v0.scaffold) or events.seg (glass.pack.v0.scaffold_seg).";

  const fileRow = el("div", "glass-file-row");
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".glass_pack,application/zip";
  fileInput.setAttribute("data-testid", "replay-file-input");
  const openBtn = el("button", undefined, "Open file…");
  openBtn.type = "button";
  openBtn.setAttribute("data-testid", "replay-open-file");
  openBtn.addEventListener("click", () => fileInput.click());
  fileRow.append(openBtn, fileInput);

  const errorBox = el("div", "glass-error");
  errorBox.setAttribute("data-testid", "replay-error");
  errorBox.style.display = "none";

  const readingLine = el("div", "glass-status-line");
  readingLine.setAttribute("data-testid", "replay-reading");

  const metaSection = el("section", "glass-meta");
  metaSection.setAttribute("data-testid", "replay-meta");
  metaSection.style.display = "none";

  const sanitizedSection = el("div", "glass-sanitized");
  sanitizedSection.setAttribute("data-testid", "replay-sanitized");
  sanitizedSection.style.display = "none";

  const controls = el("div", "glass-controls");
  const btnPlay = el("button", undefined, "Play");
  btnPlay.setAttribute("data-testid", "replay-play");
  const btnPause = el("button", undefined, "Pause");
  btnPause.setAttribute("data-testid", "replay-pause");
  const btnStart = el("button", undefined, "|◀ Start");
  btnStart.setAttribute("data-testid", "replay-jump-start");
  const btnEnd = el("button", undefined, "End ▶|");
  btnEnd.setAttribute("data-testid", "replay-jump-end");
  const btnPrev = el("button", undefined, "◀ Step");
  btnPrev.setAttribute("data-testid", "replay-step-prev");
  const btnNext = el("button", undefined, "Step ▶");
  btnNext.setAttribute("data-testid", "replay-step-next");
  const btnClose = el("button", undefined, "Close pack");
  btnClose.setAttribute("data-testid", "replay-close");
  controls.append(
    btnPlay,
    btnPause,
    btnStart,
    btnPrev,
    btnNext,
    btnEnd,
    btnClose,
  );

  const sceneSection = el("section", "glass-scene-v0");
  sceneSection.setAttribute("data-testid", "replay-scene-v0");
  const sceneTitle = el("h3", "glass-scene-v0-title", "Bounded scene (Glass Scene System v0)");
  const sceneNote = el(
    "p",
    "glass-status-line glass-scene-v0-note",
    "Canvas path — index-ordered prefix sample; not live WebSocket tail; not process topology.",
  );
  const sceneCanvas = document.createElement("canvas");
  sceneCanvas.className = "glass-scene-v0-canvas";
  sceneCanvas.setAttribute("data-testid", "replay-scene-canvas");
  sceneCanvas.setAttribute("data-scene", GLASS_SCENE_V0);
  sceneSection.append(sceneTitle, sceneNote, sceneCanvas);

  const scrub = document.createElement("input");
  scrub.type = "range";
  scrub.min = "0";
  scrub.max = "1000";
  scrub.step = "1";
  scrub.className = "glass-scrub";
  scrub.setAttribute("data-testid", "replay-scrub");

  const positionLine = el("div", "glass-status-line");
  positionLine.setAttribute("data-testid", "replay-position");

  const timeline = el("div", "glass-timeline");
  timeline.setAttribute("data-testid", "replay-timeline");

  const inspector = el("section", "glass-inspector");
  inspector.setAttribute("data-testid", "replay-inspector");
  const inspectorPre = el("pre");
  inspector.append(inspectorPre);

  const chipsRow = el("div");
  chipsRow.setAttribute("data-testid", "replay-entity-chips");

  root.append(
    banner,
    liveNav,
    dropZone,
    fileRow,
    errorBox,
    readingLine,
    metaSection,
    sanitizedSection,
    controls,
    sceneSection,
    scrub,
    positionLine,
    timeline,
    chipsRow,
    inspector,
  );

  function clearPlayTimer(): void {
    if (playTimer !== null) {
      clearInterval(playTimer);
      playTimer = null;
    }
  }

  function syncPlayTimer(): void {
    clearPlayTimer();
    if (
      state.loadStatus === "ready" &&
      state.playback === "playing" &&
      state.events.length > 0
    ) {
      playTimer = setInterval(() => {
        dispatch({ type: "tick_advance" });
      }, PLAY_INTERVAL_MS);
    }
  }

  function paintReplayScene(): void {
    const scene = compileReplayToGlassSceneV0(state);
    void renderLiveVisualOnCanvas(sceneCanvas, scene);
  }

  function dispatch(a: ReplayAction): void {
    state = reduceReplay(state, a);
    render();
    syncPlayTimer();
  }

  function loadFromFile(file: File): void {
    dispatch({ type: "start_reading", fileName: file.name });
    const gen = ++loadGeneration;
    void file.arrayBuffer().then((buf) => {
      if (gen !== loadGeneration) {
        return;
      }
      const r = loadGlassPack(new Uint8Array(buf), "basic");
      if (!r.ok) {
        dispatch({
          type: "load_err",
          fileName: file.name,
          message: r.error,
        });
        return;
      }
      dispatch({
        type: "load_ok",
        fileName: file.name,
        manifest: r.manifest,
        events: r.events,
      });
    });
  }

  attachPackDropHandlers(dropZone, loadFromFile);
  wirePackFileInput(fileInput, loadFromFile);

  btnPlay.addEventListener("click", () => dispatch({ type: "play" }));
  btnPause.addEventListener("click", () => dispatch({ type: "pause" }));
  btnStart.addEventListener("click", () => dispatch({ type: "jump_start" }));
  btnEnd.addEventListener("click", () => dispatch({ type: "jump_end" }));
  btnPrev.addEventListener("click", () => dispatch({ type: "step_prev" }));
  btnNext.addEventListener("click", () => dispatch({ type: "step_next" }));
  btnClose.addEventListener("click", () => {
    loadGeneration += 1;
    clearPlayTimer();
    dispatch({ type: "close_pack" });
  });

  scrub.addEventListener("input", () => {
    const v = Number(scrub.value) / 1000;
    dispatch({ type: "seek_fraction", t: v });
  });

  function render(): void {
    errorBox.style.display = "none";
    readingLine.textContent = "";
    metaSection.style.display = "none";
    sanitizedSection.style.display = "none";
    timeline.innerHTML = "";
    inspectorPre.textContent = "";
    chipsRow.innerHTML = "";

    const ready = state.loadStatus === "ready";
    const emptyPack = ready && state.events.length === 0;

    btnPlay.disabled =
      !ready || state.events.length === 0 || state.playback === "playing";
    btnPause.disabled = !ready || state.playback !== "playing";
    btnStart.disabled = !ready || state.events.length === 0;
    btnEnd.disabled = !ready || state.events.length === 0;
    btnPrev.disabled = !ready || state.events.length === 0;
    btnNext.disabled = !ready || state.events.length === 0;
    scrub.disabled = !ready || state.events.length <= 1;
    btnClose.disabled = state.loadStatus === "idle";

    if (state.loadStatus === "reading") {
      readingLine.textContent = `Reading ${state.packFileName ?? "pack"}…`;
    }

    if (state.loadStatus === "error") {
      errorBox.style.display = "block";
      errorBox.textContent = `${state.packFileName ? `${state.packFileName}: ` : ""}${state.loadError ?? "error"}`;
    }

    if (ready && state.manifest) {
      metaSection.style.display = "block";
      const m = state.manifest;
      metaSection.innerHTML = "";
      metaSection.append(
        el("div", undefined, `Pack: ${state.packFileName ?? "—"}`),
        el("div", undefined, `Session: ${m.session_id}`),
        el("div", undefined, `Capture mode: ${m.capture_mode}`),
        el(
          "div",
          undefined,
          `Format: ${m.pack_format_version} · events: ${state.events.length}`,
        ),
        el(
          "div",
          undefined,
          `share_safe_recommended: ${String(m.share_safe_recommended)}`,
        ),
      );
      if (m.sanitized) {
        sanitizedSection.style.display = "block";
        sanitizedSection.innerHTML = "";
        sanitizedSection.append(
          el("strong", undefined, "Sanitized pack"),
          document.createTextNode(" — redaction summary (human-readable):"),
        );
        const ul = document.createElement("ul");
        const lines = m.human_readable_redaction_summary ?? [];
        if (lines.length === 0) {
          ul.appendChild(el("li", undefined, "(no summary lines in manifest)"));
        } else {
          for (const line of lines) {
            ul.appendChild(el("li", undefined, line));
          }
        }
        sanitizedSection.append(ul);
        if (m.sanitization_profile_version) {
          sanitizedSection.appendChild(
            el(
              "div",
              "glass-status-line",
              `Profile version: ${m.sanitization_profile_version}`,
            ),
          );
        }
      } else {
        sanitizedSection.style.display = "block";
        sanitizedSection.textContent =
          "Pack is not marked sanitized — treat contents as sensitive unless you trust the source.";
      }

      if (emptyPack) {
        positionLine.textContent =
          "No events in pack (empty timeline). Playback controls disabled.";
        inspectorPre.textContent = "{}";
      } else {
        const fr = cursorFraction(state);
        scrub.value = String(Math.round(fr * 1000));
        const ev = currentEvent(state);
        const idx = state.cursorIndex;
        const total = state.events.length;
        positionLine.textContent = `Event ${idx + 1} / ${total} · seq ${ev?.seq ?? "—"} · kind ${ev?.kind ?? "—"} · ts_ns ${ev?.ts_ns ?? "—"}`;

        for (let i = 0; i < state.events.length; i++) {
          const e = state.events[i];
          if (!e) {
            continue;
          }
          const b = el(
            "button",
            undefined,
            `#${i + 1} seq=${e.seq} ${e.kind} · ${e.event_id}`,
          );
          b.dataset.index = String(i);
          if (i === state.cursorIndex) {
            b.dataset.active = "true";
          }
          b.addEventListener("click", () =>
            dispatch({ type: "seek_index", index: i }),
          );
          timeline.appendChild(b);
        }

        if (ev) {
          inspectorPre.textContent = JSON.stringify(ev, null, 2);
          const refs = entityRefsForEvent(ev);
          for (const { role, ref } of refs) {
            const chip = el(
              "span",
              "glass-entity-chip",
              `${role}: ${ref.entity_type}/${ref.entity_id}`,
            );
            chip.dataset.entityId = ref.entity_id;
            if (state.selectedEntityId === ref.entity_id) {
              chip.dataset.selected = "true";
            }
            chip.addEventListener("click", () =>
              dispatch({
                type: "select_entity",
                entityId:
                  state.selectedEntityId === ref.entity_id ? null : ref.entity_id,
              }),
            );
            chipsRow.appendChild(chip);
          }
          if (state.selectedEntityId) {
            chipsRow.appendChild(
              el(
                "div",
                "glass-status-line",
                `Selected entity_id: ${state.selectedEntityId}`,
              ),
            );
          }
        }
      }
    }

    if (state.loadStatus === "idle") {
      positionLine.textContent = "";
      scrub.value = "0";
    }

    paintReplayScene();
  }

  render();

  return {
    getState: () => state,
    dispatch,
  };
}

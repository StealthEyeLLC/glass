/**
 * Pure Tier B replay state — **static replay only**. No live bridge/WebSocket.
 * Timeline is **event-index order** (matches validated JSONL seq); `ts_ns` is display-only monotonic, not wall-clock sync.
 */
import type { EntityRef, GlassEvent, GlassManifest } from "../pack/types.js";

export type ReplayLoadStatus = "idle" | "reading" | "ready" | "error";

export type PlaybackMode = "playing" | "paused";

export interface ReplayState {
  loadStatus: ReplayLoadStatus;
  packFileName?: string;
  loadError?: string;
  manifest: GlassManifest | null;
  events: GlassEvent[];
  playback: PlaybackMode;
  /** 0-based index into `events`; if `events.length === 0`, stays 0 */
  cursorIndex: number;
  /** Focused entity id from current event (actor/subject/parent); optional */
  selectedEntityId: string | null;
}

export type ReplayAction =
  | { type: "start_reading"; fileName: string }
  | {
      type: "load_ok";
      fileName: string;
      manifest: GlassManifest;
      events: GlassEvent[];
    }
  | { type: "load_err"; fileName?: string; message: string }
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek_index"; index: number }
  | { type: "seek_fraction"; t: number }
  | { type: "step_next" }
  | { type: "step_prev" }
  | { type: "jump_start" }
  | { type: "jump_end" }
  | { type: "tick_advance" }
  | { type: "select_entity"; entityId: string | null }
  | { type: "close_pack" };

export function initialReplayState(): ReplayState {
  return {
    loadStatus: "idle",
    manifest: null,
    events: [],
    playback: "paused",
    cursorIndex: 0,
    selectedEntityId: null,
  };
}

function clampCursor(index: number, eventCount: number): number {
  if (eventCount <= 0) {
    return 0;
  }
  const i = Math.floor(index);
  if (i < 0) {
    return 0;
  }
  if (i >= eventCount) {
    return eventCount - 1;
  }
  return i;
}

export function reduceReplay(state: ReplayState, action: ReplayAction): ReplayState {
  switch (action.type) {
    case "start_reading":
      return {
        ...initialReplayState(),
        loadStatus: "reading",
        packFileName: action.fileName,
      };
    case "load_ok":
      return {
        ...initialReplayState(),
        loadStatus: "ready",
        packFileName: action.fileName,
        manifest: action.manifest,
        events: action.events,
        playback: "paused",
        cursorIndex: clampCursor(0, action.events.length),
        selectedEntityId: null,
      };
    case "load_err":
      return {
        ...initialReplayState(),
        loadStatus: "error",
        packFileName: action.fileName,
        loadError: action.message,
      };
    case "close_pack":
      return initialReplayState();
    case "play":
      if (state.loadStatus !== "ready") {
        return state;
      }
      if (state.events.length === 0) {
        return { ...state, playback: "paused" };
      }
      return { ...state, playback: "playing" };
    case "pause":
      return { ...state, playback: "paused" };
    case "seek_index":
      if (state.loadStatus !== "ready") {
        return state;
      }
      return {
        ...state,
        playback: "paused",
        cursorIndex: clampCursor(action.index, state.events.length),
      };
    case "seek_fraction": {
      if (state.loadStatus !== "ready") {
        return state;
      }
      const n = state.events.length;
      if (n <= 0) {
        return { ...state, playback: "paused", cursorIndex: 0 };
      }
      const t = Math.max(0, Math.min(1, action.t));
      const idx = n <= 1 ? 0 : Math.round(t * (n - 1));
      return {
        ...state,
        playback: "paused",
        cursorIndex: clampCursor(idx, n),
      };
    }
    case "step_next":
      if (state.loadStatus !== "ready" || state.events.length === 0) {
        return state;
      }
      return {
        ...state,
        playback: "paused",
        cursorIndex: clampCursor(state.cursorIndex + 1, state.events.length),
      };
    case "step_prev":
      if (state.loadStatus !== "ready" || state.events.length === 0) {
        return state;
      }
      return {
        ...state,
        playback: "paused",
        cursorIndex: clampCursor(state.cursorIndex - 1, state.events.length),
      };
    case "jump_start":
      if (state.loadStatus !== "ready") {
        return state;
      }
      return {
        ...state,
        playback: "paused",
        cursorIndex: 0,
      };
    case "jump_end":
      if (state.loadStatus !== "ready") {
        return state;
      }
      return {
        ...state,
        playback: "paused",
        cursorIndex: clampCursor(
          state.events.length > 0 ? state.events.length - 1 : 0,
          state.events.length,
        ),
      };
    case "tick_advance":
      if (state.loadStatus !== "ready" || state.playback !== "playing") {
        return state;
      }
      if (state.events.length === 0) {
        return { ...state, playback: "paused" };
      }
      if (state.cursorIndex >= state.events.length - 1) {
        return { ...state, playback: "paused" };
      }
      return {
        ...state,
        cursorIndex: state.cursorIndex + 1,
      };
    case "select_entity":
      return { ...state, selectedEntityId: action.entityId };
  }
}

export function currentEvent(state: ReplayState): GlassEvent | undefined {
  if (state.loadStatus !== "ready" || state.events.length === 0) {
    return undefined;
  }
  return state.events[state.cursorIndex];
}

/** Fraction 0..1 for scrubber when events.length > 1 */
export function cursorFraction(state: ReplayState): number {
  if (state.loadStatus !== "ready" || state.events.length <= 1) {
    return 0;
  }
  return state.cursorIndex / (state.events.length - 1);
}

export function entityRefsForEvent(ev: GlassEvent): { role: string; ref: EntityRef }[] {
  const out: { role: string; ref: EntityRef }[] = [
    { role: "actor", ref: ev.actor },
  ];
  if (ev.subject) {
    out.push({ role: "subject", ref: ev.subject });
  }
  if (ev.parent) {
    out.push({ role: "parent", ref: ev.parent });
  }
  return out;
}

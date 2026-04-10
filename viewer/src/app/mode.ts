/** Application mode — static build is replay-only. */
export type AppMode = "static_replay";

export function getBuildMode(): AppMode {
  return "static_replay";
}

/** Which UI shell to mount — replay vs dev live-session consumer (same static build). */
export type UiSurface = "replay" | "live_session";

export function uiSurfaceFromSearch(search: string): UiSurface {
  return new URLSearchParams(search).get("live") === "1"
    ? "live_session"
    : "replay";
}

export function getUiSurface(): UiSurface {
  if (typeof window === "undefined") {
    return "replay";
  }
  return uiSurfaceFromSearch(window.location.search);
}

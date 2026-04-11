/**
 * Tier B static replay shell by default; optional `?live=1` mounts the live-session skeleton
 * (bridge WS + HTTP) — see `docs/IMPLEMENTATION_STATUS.md`.
 */
import { getUiSurface } from "./app/mode.js";
import { mountLiveSessionShell } from "./live/liveSessionShell.js";
import { mountReplayShell } from "./replay/replayOnlyShell.js";

const root = document.querySelector("#app");
if (!root) {
  throw new Error("#app missing");
}
const uiSurface = getUiSurface();
document.title =
  uiSurface === "live_session"
    ? "Glass — bounded live session showcase"
    : "Glass — bounded replay showcase";

if (uiSurface === "live_session") {
  mountLiveSessionShell(root);
} else {
  mountReplayShell(root);
}

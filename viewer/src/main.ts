/**
 * Tier B static replay shell only. No WebGPU rendering yet (Phase 6).
 * Live capture entrypoints are explicitly absent.
 */
import { mountReplayShell } from "./replay/replayOnlyShell.js";

const root = document.querySelector("#app");
if (!root) {
  throw new Error("#app missing");
}
mountReplayShell(root);

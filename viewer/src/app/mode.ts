/** Application mode — static build is replay-only. */
export type AppMode = "static_replay";

export function getBuildMode(): AppMode {
  return "static_replay";
}

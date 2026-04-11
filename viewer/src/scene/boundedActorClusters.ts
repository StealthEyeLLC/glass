/**
 * Bounded actor / sample clusters — derived only from current bounded event samples and
 * honest session facts (no topology, no graph edges).
 */

import type { ReplayState } from "../replay/replayModel.js";
import type { SceneActorCluster, SceneActorClusterLane } from "./glassSceneV0.js";

const EMPHASIS_CAP = 12;

/** Extract `kind` from a normalized event-shaped object, if present. */
export function eventKindFromUnknown(ev: unknown): string | null {
  if (ev === null || typeof ev !== "object" || Array.isArray(ev)) {
    return null;
  }
  const k = (ev as Record<string, unknown>).kind;
  return typeof k === "string" ? k : null;
}

export interface KindBucketCounts {
  process: number;
  file: number;
  other: number;
}

/** Count `process_*`, `command_exec`, `env_access` vs `file_*` vs other kinds in the bounded list. */
export function countBoundedKindBuckets(events: readonly unknown[]): KindBucketCounts {
  let process = 0;
  let file = 0;
  let other = 0;
  for (const ev of events) {
    const k = eventKindFromUnknown(ev);
    if (!k) {
      other++;
      continue;
    }
    if (k.startsWith("process_") || k === "command_exec" || k === "env_access") {
      process++;
      continue;
    }
    if (k.startsWith("file_")) {
      file++;
      continue;
    }
    other++;
  }
  return { process, file, other };
}

function emphasisFromCount(n: number): number {
  if (n <= 0) {
    return 0;
  }
  return Math.min(1, n / EMPHASIS_CAP);
}

export interface LiveClusterFacts {
  snapshotOriginLabel: string | null;
  warningCode: string | null;
  resyncReason: string | null;
  reconcileSummary: string | null;
}

/**
 * Live WS tail → up to four clusters: system (if reconcile/warning/resync), process, file, snapshot origin.
 */
export function deriveLiveBoundedActorClusters(
  eventTail: readonly unknown[],
  facts: LiveClusterFacts,
): SceneActorCluster[] {
  const { process, file } = countBoundedKindBuckets(eventTail);
  const out: SceneActorCluster[] = [];

  const systemActive =
    Boolean(facts.warningCode) ||
    Boolean(facts.resyncReason && facts.resyncReason.length > 0) ||
    Boolean(facts.reconcileSummary && facts.reconcileSummary.length > 0);
  if (systemActive) {
    let em = 0.55;
    if (facts.warningCode) {
      em = 1;
    } else if (facts.resyncReason && facts.resyncReason.length > 0) {
      em = 0.88;
    }
    out.push({
      id: "cl_system",
      lane: "system_attention",
      label: "System",
      sampleCount: 1,
      emphasis01: em,
    });
  }

  if (process > 0) {
    out.push({
      id: "cl_process",
      lane: "process_samples",
      label: "Process",
      sampleCount: process,
      emphasis01: emphasisFromCount(process),
    });
  }
  if (file > 0) {
    out.push({
      id: "cl_file",
      lane: "file_samples",
      label: "File",
      sampleCount: file,
      emphasis01: emphasisFromCount(file),
    });
  }

  const origin = facts.snapshotOriginLabel;
  if (origin !== null && origin !== undefined && String(origin).length > 0) {
    out.push({
      id: "cl_snapshot",
      lane: "snapshot_origin",
      label: "Origin",
      sampleCount: 1,
      emphasis01: 1,
    });
  }

  if (out.length === 0) {
    out.push({
      id: "cl_idle",
      lane: "empty_sample",
      label: "Tail",
      sampleCount: 0,
      emphasis01: 0.12,
    });
  }

  return out.slice(0, 4);
}

function lanePriority(lane: SceneActorClusterLane): number {
  switch (lane) {
    case "system_attention":
      return 0;
    case "replay_index_prefix":
      return 1;
    case "process_samples":
      return 2;
    case "file_samples":
      return 3;
    case "snapshot_origin":
      return 4;
    case "empty_sample":
      return 9;
    default:
      return 5;
  }
}

/** Replay prefix events only (index order, honest sample). */
export function deriveReplayBoundedActorClusters(state: ReplayState, prefixEvents: readonly unknown[]): SceneActorCluster[] {
  if (state.loadStatus === "error") {
    return [
      {
        id: "cl_system",
        lane: "system_attention",
        label: "Load",
        sampleCount: 1,
        emphasis01: 1,
      },
    ];
  }
  if (state.loadStatus === "reading") {
    return [
      {
        id: "cl_system",
        lane: "system_attention",
        label: "Reading",
        sampleCount: 1,
        emphasis01: 0.45,
      },
    ];
  }
  if (state.loadStatus === "idle") {
    return [
      {
        id: "cl_idle",
        lane: "empty_sample",
        label: "Pack",
        sampleCount: 0,
        emphasis01: 0.1,
      },
    ];
  }

  const total = state.events.length;
  const out: SceneActorCluster[] = [];

  if (total > 0) {
    const prefixLen = state.cursorIndex + 1;
    out.push({
      id: "cl_replay_prefix",
      lane: "replay_index_prefix",
      label: "Prefix",
      sampleCount: prefixLen,
      emphasis01: Math.min(1, prefixLen / Math.max(total, 1)),
    });
  }

  const { process, file } = countBoundedKindBuckets(prefixEvents);
  if (process > 0) {
    out.push({
      id: "cl_process",
      lane: "process_samples",
      label: "Process",
      sampleCount: process,
      emphasis01: emphasisFromCount(process),
    });
  }
  if (file > 0) {
    out.push({
      id: "cl_file",
      lane: "file_samples",
      label: "File",
      sampleCount: file,
      emphasis01: emphasisFromCount(file),
    });
  }

  if (out.length === 0) {
    out.push({
      id: "cl_idle",
      lane: "empty_sample",
      label: "Events",
      sampleCount: 0,
      emphasis01: 0.12,
    });
  }

  out.sort((a, b) => lanePriority(a.lane) - lanePriority(b.lane));
  return out.slice(0, 4);
}

export function formatActorClusterSummaryLine(clusters: readonly SceneActorCluster[]): string {
  if (clusters.length === 0) {
    return "";
  }
  return clusters
    .map((c) => {
      if (c.lane === "empty_sample") {
        return `${c.label}:∅`;
      }
      if (c.lane === "system_attention" || c.lane === "snapshot_origin") {
        return c.label;
      }
      return `${c.label}×${c.sampleCount}`;
    })
    .join(" · ");
}

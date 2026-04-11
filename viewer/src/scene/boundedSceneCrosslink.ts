/**
 * Vertical Slice v10 — bounded cross-linking (pure, deterministic).
 * Maps evidence row anchors and compare UI targets to the same `glass.sel.v0:*` ids as scene hit-testing.
 * No graph traversal, no inferred causality, no second authority.
 */

import type { GlassEvent } from "../pack/types.js";
import type { LiveVisualSpec } from "../live/liveVisualModel.js";
import { eventKindFromUnknown } from "./boundedActorClusters.js";
import type { GlassSceneV0, SceneBoundedRegionRole } from "./glassSceneV0.js";
import {
  boundedSelectionIdCluster,
  boundedSelectionIdOverlay,
  boundedSelectionIdRegion,
} from "./boundedSceneSelection.js";

/**
 * Stable anchor for an evidence card — enough to resolve selection without re-parsing title lines.
 */
export type BoundedEvidenceRowKeyV0 =
  | { kind: "live_tail_event"; tailIndex: number }
  | { kind: "replay_prefix_event"; seq: number; event_id: string }
  | { kind: "none" };

export interface BoundedCrosslinkResolutionV0 {
  /** When non-null, same vocabulary as `buildBoundedSelectionHitTargetsForScene`. */
  targetSelectionId: string | null;
  /** Shown when the user activates a row/fact that has no honest scene target. */
  honestyNote: string | null;
}

function regionIdForRole(scene: GlassSceneV0, role: SceneBoundedRegionRole): string | null {
  const r = scene.regions.find((x) => x.role === role);
  return r?.id ?? null;
}

/**
 * Maps event kind to at most one bounded process/file cluster id — same buckets as evidence filtering.
 */
export function honestBoundedClusterIdFromEvent(ev: unknown): "cl_process" | "cl_file" | null {
  const k = eventKindFromUnknown(ev);
  if (!k) {
    return null;
  }
  if (k.startsWith("process_") || k === "command_exec" || k === "env_access") {
    return "cl_process";
  }
  if (k.startsWith("file_")) {
    return "cl_file";
  }
  return null;
}

function clusterPresent(scene: GlassSceneV0, clusterId: string): boolean {
  return scene.clusters.some((c) => c.id === clusterId);
}

/**
 * Resolve an evidence row key to a bounded scene selection id when the current frame supports it.
 */
export function resolveEvidenceRowKeyToSelection(
  scene: GlassSceneV0,
  key: BoundedEvidenceRowKeyV0,
  ctx: {
    liveEventTail: readonly unknown[] | null;
    replayEvents: readonly GlassEvent[] | null;
  },
): BoundedCrosslinkResolutionV0 {
  if (key.kind === "none") {
    return {
      targetSelectionId: null,
      honestyNote: "This evidence row is not anchored for cross-linking.",
    };
  }

  if (key.kind === "live_tail_event") {
    const tail = ctx.liveEventTail;
    if (!tail || tail.length === 0) {
      return {
        targetSelectionId: null,
        honestyNote: "No bounded WebSocket tail — cannot map this row.",
      };
    }
    const ev = tail[key.tailIndex];
    if (ev === undefined) {
      return {
        targetSelectionId: null,
        honestyNote: "Tail index is outside the current bounded sample.",
      };
    }
    return clusterResolutionForEvent(scene, ev);
  }

  const events = ctx.replayEvents;
  if (!events || events.length === 0) {
    return {
      targetSelectionId: null,
      honestyNote: "No replay prefix loaded — cannot map this row.",
    };
  }
  const ev = events.find((e) => e.seq === key.seq && e.event_id === key.event_id);
  if (!ev) {
    return {
      targetSelectionId: null,
      honestyNote: "That event is not in the current index-ordered prefix.",
    };
  }
  return clusterResolutionForEvent(scene, ev);
}

function clusterResolutionForEvent(scene: GlassSceneV0, ev: unknown): BoundedCrosslinkResolutionV0 {
  const cid = honestBoundedClusterIdFromEvent(ev);
  if (!cid) {
    return {
      targetSelectionId: null,
      honestyNote:
        "This row’s event kind does not map to a single bounded cluster (process vs file) in Glass v0.",
    };
  }
  if (!clusterPresent(scene, cid)) {
    return {
      targetSelectionId: null,
      honestyNote: `Cluster ${cid} is not present in this bounded frame.`,
    };
  }
  return { targetSelectionId: boundedSelectionIdCluster(cid), honestyNote: null };
}

/**
 * System / reconcile / warning “area” — maps to the `system_integrity_rail` region when it exists.
 */
export function resolveSystemIntegrityRegionSelection(scene: GlassSceneV0): BoundedCrosslinkResolutionV0 {
  const rid = regionIdForRole(scene, "system_integrity_rail");
  if (!rid) {
    return {
      targetSelectionId: null,
      honestyNote: "No system/reconcile region in this bounded layout.",
    };
  }
  return { targetSelectionId: boundedSelectionIdRegion(rid), honestyNote: null };
}

/**
 * Evidence strip / sample area — maps to `bounded_sample_evidence` region when present.
 */
export function resolveBoundedEvidenceRegionSelection(scene: GlassSceneV0): BoundedCrosslinkResolutionV0 {
  const rid = regionIdForRole(scene, "bounded_sample_evidence");
  if (!rid) {
    return {
      targetSelectionId: null,
      honestyNote: "No bounded evidence region in this layout.",
    };
  }
  return { targetSelectionId: boundedSelectionIdRegion(rid), honestyNote: null };
}

/**
 * Compare summary / selection overlay lines use the same ids as Canvas overlay hit targets.
 * Prefer selection-scoped compare when available (more specific).
 */
export function resolveCompareEvidenceCrosslink(spec: LiveVisualSpec): BoundedCrosslinkResolutionV0 {
  if (spec.boundedCompareSelectionLine) {
    return { targetSelectionId: boundedSelectionIdOverlay("compare_selection"), honestyNote: null };
  }
  if (spec.boundedCompareSummaryLine) {
    return { targetSelectionId: boundedSelectionIdOverlay("compare_summary"), honestyNote: null };
  }
  if (spec.boundedCompareUnavailableReason) {
    return { targetSelectionId: boundedSelectionIdOverlay("compare_unavailable"), honestyNote: null };
  }
  return {
    targetSelectionId: null,
    honestyNote: "Compare lines are not present for this bounded frame.",
  };
}

/**
 * Whether an evidence row’s resolved target matches the current scene selection (for card highlight).
 */
export function evidenceRowLinkedToSelection(
  resolution: BoundedCrosslinkResolutionV0,
  selectedSelectionId: string | null,
): boolean {
  if (!resolution.targetSelectionId || !selectedSelectionId) {
    return false;
  }
  return resolution.targetSelectionId === selectedSelectionId;
}

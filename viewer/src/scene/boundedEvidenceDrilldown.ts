/**
 * Vertical Slice v9 — bounded evidence drilldown (pure, deterministic).
 * Surfaces only rows/facts the current bounded sample actually contains — no causality chain, no topology graph.
 */

import type { GlassEvent } from "../pack/types.js";
import type { LiveVisualSpec } from "../live/liveVisualModel.js";
import { eventKindFromUnknown, countBoundedKindBuckets } from "./boundedActorClusters.js";
import type { BoundedSceneCompareV0 } from "./boundedSceneCompare.js";
import type { GlassSceneV0 } from "./glassSceneV0.js";

export const BOUNDED_EVIDENCE_DRILLDOWN_KIND = "glass.evidence.v0" as const;

const SEL_PREFIX = "glass.sel.v0" as const;
const MAX_EVIDENCE_ROWS = 6;

export type BoundedEvidenceRowLabel =
  | "live_tail"
  | "replay_prefix"
  | "current_step"
  | "changed"
  | "sampled"
  | "fact_only";

export interface BoundedEvidenceRowV0 {
  kind: "glass.evidence_row.v0";
  rowLabel: BoundedEvidenceRowLabel;
  titleLine: string;
  detailLine: string | null;
}

export interface BoundedEvidenceDrilldownV0 {
  kind: typeof BOUNDED_EVIDENCE_DRILLDOWN_KIND;
  /** One line: live tail vs replay prefix scope */
  scopeLine: string;
  honestyLine: string;
  selectedTargetSummary: string | null;
  compareSummaryLine: string | null;
  compareEvidenceNote: string | null;
  facts: readonly string[];
  rows: readonly BoundedEvidenceRowV0[];
}

export interface BoundedEvidenceDrilldownInput {
  scene: GlassSceneV0;
  spec: LiveVisualSpec;
  compare: BoundedSceneCompareV0;
  selectedSelectionId: string | null;
  /** Prior frame sample count (tail length or replay prefix depth) for honest “changed” marking */
  previousBoundedSampleCount: number | null;
  /** Live path: bounded WS tail (oldest → newest) */
  liveEventTail: readonly unknown[] | null;
  /** Replay path: pack events + cursor */
  replay: {
    events: readonly GlassEvent[];
    cursorIndex: number;
  } | null;
}

function clusterIdFromSelection(selectedId: string | null): string | null {
  if (!selectedId || !selectedId.startsWith(`${SEL_PREFIX}:cluster:`)) {
    return null;
  }
  return selectedId.slice(`${SEL_PREFIX}:cluster:`.length);
}

function eventMatchesClusterId(ev: unknown, clusterId: string): boolean {
  switch (clusterId) {
    case "cl_process": {
      const k = eventKindFromUnknown(ev);
      if (!k) {
        return false;
      }
      return k.startsWith("process_") || k === "command_exec" || k === "env_access";
    }
    case "cl_file": {
      const k = eventKindFromUnknown(ev);
      if (!k) {
        return false;
      }
      return k.startsWith("file_");
    }
    case "cl_replay_prefix":
      return true;
    case "cl_system":
    case "cl_snapshot":
      return false;
    case "cl_idle":
      return true;
    default:
      return true;
  }
}

function formatGlassEventOneLine(ev: GlassEvent): string {
  return `seq=${ev.seq} · ${ev.kind} · ${ev.event_id}`;
}

function formatUnknownTailEvent(ev: unknown, tailIndex: number): string {
  if (ev !== null && typeof ev === "object" && !Array.isArray(ev)) {
    const r = ev as Record<string, unknown>;
    const seq = r.seq;
    const kind = r.kind;
    return `tail[${tailIndex}] · seq=${seq ?? "—"} · kind=${typeof kind === "string" ? kind : "—"}`;
  }
  return `tail[${tailIndex}] · (non-object sample)`;
}

function formatSelectionTargetSummary(scene: GlassSceneV0, selectedId: string | null): string | null {
  if (!selectedId) {
    return null;
  }
  if (selectedId.startsWith(`${SEL_PREFIX}:cluster:`)) {
    const cid = selectedId.slice(`${SEL_PREFIX}:cluster:`.length);
    const c = scene.clusters.find((x) => x.id === cid);
    return c ? `Cluster: ${c.label} (${c.lane})` : `Cluster id: ${cid}`;
  }
  if (selectedId.startsWith(`${SEL_PREFIX}:region:`)) {
    const rid = selectedId.slice(`${SEL_PREFIX}:region:`.length);
    const reg = scene.regions.find((r) => r.id === rid);
    return reg ? `Region: ${reg.label} (${reg.role})` : `Region id: ${rid}`;
  }
  if (selectedId.includes(":wire:")) {
    return "Wire / density band (bounded presentation)";
  }
  if (selectedId.includes(":state_rail:")) {
    return "State rail segment (bounded lanes)";
  }
  if (selectedId.includes(":overlay:")) {
    return "Overlay line (Canvas — same facts as strip)";
  }
  return "Selected scene target";
}

function buildFacts(
  scene: GlassSceneV0,
  spec: LiveVisualSpec,
  clusterId: string | null,
): string[] {
  const out: string[] = [];
  out.push(`Sample scope: ${scene.honesty.sampleScope}`);
  if (clusterId === "cl_system") {
    out.push(
      "System lane summarizes warning / resync / reconcile flags — not a per-event syscall trace.",
    );
    if (spec.warningCode) {
      out.push(`Warning code: ${spec.warningCode}`);
    }
    if (spec.resyncReason) {
      out.push(`Resync reason: ${spec.resyncReason}`);
    }
    if (spec.reconcileSummary) {
      out.push(`HTTP reconcile: ${spec.reconcileSummary}`);
    }
  }
  if (clusterId === "cl_snapshot" && spec.snapshotOriginLabel) {
    out.push(`snapshot_origin label: ${spec.snapshotOriginLabel}`);
  }
  return out.slice(0, 8);
}

function pickRowLabel(args: {
  source: "live" | "replay";
  isCurrentReplayStep: boolean;
  isChangedSincePrior: boolean;
  clusterFilterActive: boolean;
}): BoundedEvidenceRowLabel {
  if (args.isCurrentReplayStep) {
    return "current_step";
  }
  if (args.isChangedSincePrior) {
    return "changed";
  }
  if (args.clusterFilterActive) {
    return "sampled";
  }
  if (args.source === "live") {
    return "live_tail";
  }
  return "replay_prefix";
}

/**
 * Pure drilldown: bounded event rows + facts tied to selection and compare — no second authority.
 */
export function computeBoundedEvidenceDrilldown(input: BoundedEvidenceDrilldownInput): BoundedEvidenceDrilldownV0 {
  const { scene, spec, compare, selectedSelectionId, previousBoundedSampleCount, liveEventTail, replay } = input;
  const clusterId = clusterIdFromSelection(selectedSelectionId);
  const clusterFilterActive = Boolean(
    clusterId && clusterId !== "cl_system" && clusterId !== "cl_snapshot",
  );

  const facts = buildFacts(scene, spec, clusterId);
  const selectedTargetSummary = formatSelectionTargetSummary(scene, selectedSelectionId);

  let scopeLine: string;
  let rows: BoundedEvidenceRowV0[] = [];
  let compareEvidenceNote: string | null = null;

  if (!compare.available) {
    compareEvidenceNote =
      "Compare needs a prior bounded frame on this path — row labels are not “delta” markers.";
  } else if (compare.hints.densityOrTailChanged && previousBoundedSampleCount !== null) {
    compareEvidenceNote =
      "‘changed’ marks rows that entered the bounded sample after the prior frame when growth was append-style; replace/resync may reset the tail without a simple delta.";
  } else {
    compareEvidenceNote = null;
  }

  if (scene.source === "live") {
    scopeLine = "Evidence source: bounded WebSocket tail (oldest → newest) — not full history.";
    const tail = liveEventTail ?? [];
    if (tail.length === 0) {
      rows = [];
      return {
        kind: BOUNDED_EVIDENCE_DRILLDOWN_KIND,
        scopeLine,
        honestyLine: scene.honesty.line,
        selectedTargetSummary,
        compareSummaryLine: compare.available ? compare.summaryLine : spec.boundedCompareUnavailableReason,
        compareEvidenceNote,
        facts:
          tail.length === 0
            ? [...facts, "No events in the bounded tail yet — nothing to sample."]
            : facts,
        rows,
      };
    }
    const tailReplaced =
      compare.available &&
      compare.hints.densityOrTailChanged &&
      previousBoundedSampleCount !== null &&
      tail.length < previousBoundedSampleCount;

    let candidates: { ev: unknown; tailIndex: number }[] = tail.map((ev, tailIndex) => ({
      ev,
      tailIndex,
    }));
    if (clusterId === "cl_system" || clusterId === "cl_snapshot") {
      candidates = [];
    } else if (clusterId) {
      candidates = candidates.filter((x) => eventMatchesClusterId(x.ev, clusterId));
    }

    const sliceStart = Math.max(0, candidates.length - MAX_EVIDENCE_ROWS);
    const sliced = candidates.slice(sliceStart);

    rows = sliced.map(({ ev, tailIndex }) => {
      const globalIndex = tailIndex;
      let isChanged = false;
      if (
        compare.available &&
        compare.hints.densityOrTailChanged &&
        previousBoundedSampleCount !== null &&
        !tailReplaced
      ) {
        isChanged = globalIndex >= previousBoundedSampleCount;
      }
      const rl = pickRowLabel({
        source: "live",
        isCurrentReplayStep: false,
        isChangedSincePrior: isChanged,
        clusterFilterActive,
      });
      return {
        kind: "glass.evidence_row.v0",
        rowLabel: rl,
        titleLine: formatUnknownTailEvent(ev, tailIndex),
        detailLine: null,
      };
    });

    const extraFacts = [...facts];
    if (tailReplaced) {
      extraFacts.push(
        "Tail length decreased vs prior frame — current rows are the whole bounded tail (replace/resync style), not an append delta.",
      );
    }
    if (clusterId && rows.length === 0) {
      extraFacts.push("No tail rows match this cluster filter — kinds may be outside the bounded bucket.");
    }

    return {
      kind: BOUNDED_EVIDENCE_DRILLDOWN_KIND,
      scopeLine,
      honestyLine: scene.honesty.line,
      selectedTargetSummary,
      compareSummaryLine: compare.available ? compare.summaryLine : spec.boundedCompareUnavailableReason,
      compareEvidenceNote,
      facts: extraFacts,
      rows,
    };
  }

  // Replay
  scopeLine =
    "Evidence source: index-ordered pack prefix through the scrub cursor — not the live WebSocket tail.";
  if (!replay || replay.events.length === 0) {
    return {
      kind: BOUNDED_EVIDENCE_DRILLDOWN_KIND,
      scopeLine,
      honestyLine: scene.honesty.line,
      selectedTargetSummary,
      compareSummaryLine: compare.available ? compare.summaryLine : spec.boundedCompareUnavailableReason,
      compareEvidenceNote,
      facts: [...facts, "No replay events loaded — open a pack with events."],
      rows: [],
    };
  }

  const { events, cursorIndex } = replay;
  const prefix = events.slice(0, Math.min(cursorIndex + 1, events.length));
  let cand: GlassEvent[] = prefix;
  if (clusterId === "cl_process" || clusterId === "cl_file") {
    cand = prefix.filter((ev) => eventMatchesClusterId(ev, clusterId));
  } else if (clusterId === "cl_system" || clusterId === "cl_snapshot") {
    cand = [];
  }

  const sliceFrom = Math.max(0, cand.length - MAX_EVIDENCE_ROWS);
  const sliced = cand.slice(sliceFrom);

  rows = sliced.map((ev) => {
    const globalIdx = events.findIndex(
      (e) => e.seq === ev.seq && e.event_id === ev.event_id,
    );
    const isCurrent = globalIdx === cursorIndex;
    let isChanged = false;
    if (
      compare.available &&
      compare.hints.densityOrTailChanged &&
      previousBoundedSampleCount !== null &&
      globalIdx >= 0
    ) {
      isChanged = globalIdx >= previousBoundedSampleCount;
    }
    const rl = pickRowLabel({
      source: "replay",
      isCurrentReplayStep: isCurrent,
      isChangedSincePrior: isChanged,
      clusterFilterActive: Boolean(clusterId && (clusterId === "cl_process" || clusterId === "cl_file")),
    });
    return {
      kind: "glass.evidence_row.v0",
      rowLabel: rl,
      titleLine: formatGlassEventOneLine(ev),
      detailLine: `actor ${ev.actor.entity_type}:${ev.actor.entity_id}`,
    };
  });

  const extraFacts = [...facts];
  if (clusterId && (clusterId === "cl_process" || clusterId === "cl_file") && rows.length === 0) {
    extraFacts.push("No prefix events match this cluster’s kind bucket.");
  }
  if (clusterId === "cl_replay_prefix") {
    const { process, file } = countBoundedKindBuckets(prefix);
    const other = Math.max(0, prefix.length - process - file);
    extraFacts.push(
      `Prefix kind buckets (bounded): process=${process}, file=${file}, other=${other}.`,
    );
  }

  return {
    kind: BOUNDED_EVIDENCE_DRILLDOWN_KIND,
    scopeLine,
    honestyLine: scene.honesty.line,
    selectedTargetSummary,
    compareSummaryLine: compare.available ? compare.summaryLine : spec.boundedCompareUnavailableReason,
    compareEvidenceNote,
    facts: extraFacts,
    rows,
  };
}

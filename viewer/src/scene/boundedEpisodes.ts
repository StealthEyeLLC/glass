/**
 * Vertical Slice v12 — bounded episodes (pure, deterministic).
 * Rule-based summaries from compare hints + scene facts — not AI, not causal topology.
 */

import type { BoundedSceneCompareV0 } from "./boundedSceneCompare.js";
import type { GlassSceneV0, SceneBoundedRegionRole } from "./glassSceneV0.js";
import {
  boundedSelectionIdCluster,
  boundedSelectionIdOverlay,
  boundedSelectionIdRegion,
} from "./boundedSceneSelection.js";

export const BOUNDED_EPISODES_KIND = "glass.episodes.v0" as const;

export const BOUNDED_EPISODE_CARD_MAX = 4 as const;

export type BoundedEpisodeKindV0 =
  | "insufficient_history"
  | "resync_snapshot_rail"
  | "warning_code"
  | "http_reconcile"
  | "wire_mode"
  | "tail_replace"
  | "tail_append"
  | "tail_sample_shift"
  | "replay_cursor_step"
  | "replay_prefix_fraction"
  | "selection_cluster_delta"
  | "focus_shift"
  | "cluster_lanes"
  | "settle";

export interface BoundedEpisodeV0 {
  readonly id: string;
  readonly kind: BoundedEpisodeKindV0;
  /** Short product title — bounded wording only. */
  readonly title: string;
  readonly summary: string;
  readonly honestyNote: string | null;
  /** When set, episode click can honestly focus this selection id. */
  readonly suggestedSelectionId: string | null;
  readonly compareHookLine: string | null;
  /** First in list is the primary narrative for this frame. */
  readonly isPrimary: boolean;
}

export interface BoundedSceneEpisodesV0 {
  readonly kind: typeof BOUNDED_EPISODES_KIND;
  readonly honestyLine: string;
  readonly episodes: readonly BoundedEpisodeV0[];
}

function regionSelectionId(scene: GlassSceneV0, role: SceneBoundedRegionRole): string | null {
  const r = scene.regions.find((x) => x.role === role);
  return r ? boundedSelectionIdRegion(r.id) : null;
}

function makeEpisode(
  index: number,
  kind: BoundedEpisodeKindV0,
  title: string,
  summary: string,
  honestyNote: string | null,
  suggestedSelectionId: string | null,
  compareHookLine: string | null,
  isPrimary: boolean,
): BoundedEpisodeV0 {
  return {
    id: `ep-v12:${kind}:${index}`,
    kind,
    title,
    summary,
    honestyNote,
    suggestedSelectionId,
    compareHookLine,
    isPrimary,
  };
}

const HONESTY =
  "Episodes are rule-based summaries from bounded compare + scene fields in this viewer — not full history, not intent, not topology.";

export interface ComputeBoundedEpisodesInput {
  path: "replay" | "live";
  currentScene: GlassSceneV0;
  /** Compare baseline (may differ from immediate prior paint). */
  baselineScene: GlassSceneV0 | null;
  /** Immediate prior paint (append-style growth semantics). */
  immediatePriorScene: GlassSceneV0 | null;
  compare: BoundedSceneCompareV0;
  selectedSelectionId: string | null;
  /** Live: last applied wire tail mutation when known. */
  liveEventTailMutation: "none" | "replace" | "append" | null;
  /**
   * When false, bounded compare uses an explicit temporal-lens baseline that may not be the
   * immediate prior paint (cursor-delta episodes still use immediate prior vs current).
   */
  compareBaselineIsImmediatePrior: boolean;
}

/**
 * Derive up to four bounded episodes from compare hints and scene facts.
 */
export function computeBoundedSceneEpisodes(input: ComputeBoundedEpisodesInput): BoundedSceneEpisodesV0 {
  const {
    path,
    currentScene,
    baselineScene,
    immediatePriorScene,
    compare,
    selectedSelectionId,
    liveEventTailMutation,
    compareBaselineIsImmediatePrior,
  } = input;

  if (!compare.available || baselineScene === null) {
    return {
      kind: BOUNDED_EPISODES_KIND,
      honestyLine: HONESTY,
      episodes: [
        makeEpisode(
          0,
          "insufficient_history",
          "Not enough bounded frames yet",
          compare.unavailableReason ?? "No prior bounded frame for compare.",
          "Episodes need at least two bounded paints on this path.",
          null,
          null,
          true,
        ),
      ],
    };
  }

  const h = compare.hints;
  const base = baselineScene;
  const cur = currentScene;
  const out: BoundedEpisodeV0[] = [];
  let idx = 0;

  const push = (
    kind: BoundedEpisodeKindV0,
    title: string,
    summary: string,
    honestyNote: string | null,
    suggested: string | null,
    hook: string | null,
  ): void => {
    if (out.length >= BOUNDED_EPISODE_CARD_MAX) {
      return;
    }
    out.push(
      makeEpisode(idx++, kind, title, summary, honestyNote, suggested, hook, out.length === 0),
    );
  };

  if (h.resyncReasonChanged || (path === "live" && h.snapshotOriginChanged)) {
    push(
      "resync_snapshot_rail",
      "Snapshot / rail signal changed",
      h.resyncReasonChanged
        ? `resync reason: ${base.resyncReason ?? "—"} → ${cur.resyncReason ?? "—"}`
        : `snapshot_origin label: ${base.snapshotOriginLabel ?? "—"} → ${cur.snapshotOriginLabel ?? "—"}`,
      path === "live"
        ? null
        : "Replay uses pack prefix facts — rail strings may differ from live WS tail.",
      regionSelectionId(cur, "system_integrity_rail"),
      compare.summaryLine,
    );
  }

  if (h.warningChanged) {
    push(
      "warning_code",
      "Warning code changed",
      `warning: ${base.warningCode ?? "—"} → ${cur.warningCode ?? "—"}`,
      null,
      regionSelectionId(cur, "system_integrity_rail"),
      compare.summaryLine,
    );
  }

  if (h.reconcileChanged) {
    push(
      "http_reconcile",
      "HTTP reconcile line changed",
      `reconcile: ${base.reconcileSummary ?? "—"} → ${cur.reconcileSummary ?? "—"}`,
      null,
      boundedSelectionIdOverlay("http_reconcile_line"),
      compare.summaryLine,
    );
  }

  if (h.wireModeChanged) {
    push(
      "wire_mode",
      "Wire mode changed",
      `${base.wireMode} → ${cur.wireMode}`,
      null,
      regionSelectionId(cur, "primary_wire_sample"),
      compare.summaryLine,
    );
  }

  if (h.densityOrTailChanged) {
    const dn = cur.boundedSampleCount - base.boundedSampleCount;
    if (dn < 0) {
      push(
        "tail_replace",
        "Bounded sample mass shrank",
        `tail count ${base.boundedSampleCount} → ${cur.boundedSampleCount} (replace/resync style shrink — not an append delta).`,
        liveEventTailMutation === "append"
          ? "Last wire reported append while counts shrank — compare uses your selected baseline vs current frame."
          : null,
        regionSelectionId(cur, "primary_wire_sample"),
        compare.summaryLine,
      );
    } else if (dn > 0) {
      push(
        "tail_append",
        "Bounded sample mass grew",
        `tail count ${base.boundedSampleCount} → ${cur.boundedSampleCount}${
          path === "live" && liveEventTailMutation === "append" ? " (append-style wire)" : ""
        }.`,
        null,
        regionSelectionId(cur, "bounded_sample_evidence"),
        compare.summaryLine,
      );
    } else {
      push(
        "tail_sample_shift",
        "Density changed at same tail size",
        `density ${base.density01.toFixed(3)} → ${cur.density01.toFixed(3)} (n=${cur.boundedSampleCount}).`,
        null,
        regionSelectionId(cur, "primary_wire_sample"),
        compare.summaryLine,
      );
    }
  }

  const replayCursorChangedVsPrior =
    path === "replay" &&
    immediatePriorScene !== null &&
    (immediatePriorScene.replayCursorIndex ?? null) !== (cur.replayCursorIndex ?? null);
  if (replayCursorChangedVsPrior) {
    push(
      "replay_cursor_step",
      "Replay cursor moved",
      `seq index ${immediatePriorScene.replayCursorIndex ?? "—"} → ${cur.replayCursorIndex ?? "—"} (immediate prior paint vs current — bounded).`,
      !compareBaselineIsImmediatePrior
        ? "Compare baseline may differ from immediate prior — cursor delta is still from last paint to this paint."
        : null,
      boundedSelectionIdOverlay("replay_prefix_caption"),
      compare.summaryLine,
    );
  }

  if (h.replayPrefixChanged) {
    push(
      "replay_prefix_fraction",
      "Replay prefix fraction changed",
      `${base.replayPrefixFraction ?? "—"} → ${cur.replayPrefixFraction ?? "—"}`,
      path === "live" ? "Replay prefix is replay-only — this hint is unexpected on live." : null,
      boundedSelectionIdOverlay("replay_prefix_caption"),
      compare.summaryLine,
    );
  }

  if (compare.selectionCompareLine) {
    push(
      "selection_cluster_delta",
      "Selection-scoped cluster delta",
      compare.selectionCompareLine,
      null,
      selectedSelectionId && selectedSelectionId.includes(":cluster:")
        ? selectedSelectionId
        : null,
      compare.selectionCompareLine,
    );
  } else if (h.focusTargetChanged && selectedSelectionId) {
    push(
      "focus_shift",
      "Focus / caption changed",
      "Focus target or caption for the current selection changed vs baseline.",
      null,
      selectedSelectionId,
      compare.summaryLine,
    );
  }

  if (h.clusterIdsWithBoundedDelta.length > 0 && out.length < BOUNDED_EPISODE_CARD_MAX) {
    const ids = h.clusterIdsWithBoundedDelta.slice(0, 3).join(", ");
    push(
      "cluster_lanes",
      "Cluster lanes changed",
      `Clusters touched: ${ids}${h.clusterIdsWithBoundedDelta.length > 3 ? "…" : ""}`,
      null,
      boundedSelectionIdCluster(h.clusterIdsWithBoundedDelta[0] ?? "cl_process"),
      compare.summaryLine,
    );
  }

  if (out.length === 0) {
    push(
      "settle",
      "No material bounded change",
      "vs baseline: bounded snapshot fields match within compare tolerance.",
      "Episodes are shallow when compare shows no deltas — that is expected.",
      null,
      compare.summaryLine,
    );
  }

  return {
    kind: BOUNDED_EPISODES_KIND,
    honestyLine: HONESTY,
    episodes: out.slice(0, BOUNDED_EPISODE_CARD_MAX),
  };
}

/** Returns true if the selected episode id is still present after recompute. */
export function boundedEpisodeSelectionStillValid(
  episodes: readonly BoundedEpisodeV0[],
  selectedId: string | null,
): boolean {
  if (!selectedId) {
    return true;
  }
  return episodes.some((e) => e.id === selectedId);
}

/** Evidence panel copy for a selected episode — deterministic, rule-based. */
export function boundedEpisodeEvidenceUiLines(
  episodes: readonly BoundedEpisodeV0[],
  selectedEpisodeId: string | null,
): { contextLine: string | null; honestyNote: string | null } {
  const ep = selectedEpisodeId ? episodes.find((e) => e.id === selectedEpisodeId) : undefined;
  if (!ep) {
    return { contextLine: null, honestyNote: null };
  }
  const contextLine = `Bounded episode: ${ep.title} — ${ep.summary}`;
  let honestyNote: string | null = ep.honestyNote;
  if (!honestyNote && !ep.suggestedSelectionId) {
    honestyNote =
      "No additional scene selection target for this episode — compare and facts above remain the bounded evidence.";
  }
  return { contextLine, honestyNote };
}

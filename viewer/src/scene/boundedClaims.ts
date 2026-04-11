/**
 * Vertical Slice v13 — bounded claims (pure, deterministic).
 * Explicit, evidence-stated claims from compare + drilldown + episodes — not AI, not causal topology.
 */

import type { BoundedSceneCompareV0 } from "./boundedSceneCompare.js";
import type { BoundedEvidenceDrilldownV0 } from "./boundedEvidenceDrilldown.js";
import type { BoundedSceneEpisodesV0, BoundedEpisodeKindV0, BoundedEpisodeV0 } from "./boundedEpisodes.js";
import type { GlassSceneV0 } from "./glassSceneV0.js";

export const BOUNDED_CLAIMS_KIND = "glass.claims.v0" as const;

export const BOUNDED_CLAIM_CARD_MAX = 6 as const;

/** Bounded confidence — not numeric probability. */
export type BoundedClaimStatusV0 =
  | "observed"
  | "inferred_from_bounded_change"
  | "weak"
  | "unavailable";

export type BoundedClaimKindV0 =
  | "no_compare_baseline"
  | "replace_tail"
  | "append_growth"
  | "density_shift"
  | "warning_onset"
  | "reconcile_resync"
  | "wire_mode_change"
  | "replay_step_change"
  | "selection_linked_change"
  | "cluster_lanes_change"
  | "no_material_change";

export interface BoundedClaimV0 {
  readonly id: string;
  readonly kind: BoundedClaimKindV0;
  readonly title: string;
  /** Single bounded sentence — what the operator may claim. */
  readonly statement: string;
  readonly status: BoundedClaimStatusV0;
  /** Hooks into compare line, facts, episode — short strings only. */
  readonly evidenceRefs: readonly string[];
  /** What this claim does not imply (bounded honesty). */
  readonly doesNotImply: string;
  /** Source episode card when claim is episode-derived. */
  readonly relatedEpisodeId: string | null;
  readonly suggestedSelectionId: string | null;
  readonly honestyNote: string | null;
}

export interface BoundedSceneClaimsV0 {
  readonly kind: typeof BOUNDED_CLAIMS_KIND;
  readonly honestyLine: string;
  readonly claims: readonly BoundedClaimV0[];
  /** Highlight target when no explicit claim selection. */
  readonly primaryClaimId: string | null;
}

const PACK_HONESTY =
  "Claims are derived only from bounded compare, scene fields, evidence drilldown, and episode cards in this viewer — not full history, not agent intent, not topology.";

const DOES_NOT: Record<BoundedClaimKindV0, string> = {
  no_compare_baseline:
    "Does not imply absence of activity outside this viewer path or durable session truth.",
  replace_tail:
    "Does not prove causal ordering beyond bounded tail replace semantics in this compare window.",
  append_growth:
    "Does not imply unbounded retention, complete audit history, or extra events not in the bounded sample.",
  density_shift:
    "Does not imply syscall-level or host-wide load — only bounded density fields on this frame.",
  warning_onset:
    "Does not interpret operator action or collector intent — only warning fields present on the scene.",
  reconcile_resync:
    "Does not merge HTTP snapshot rows into WS tail — reconcile/resync strings are bounded labels here.",
  wire_mode_change:
    "Does not imply network or bridge intent — only the wire mode field on the bounded scene.",
  replay_step_change:
    "Does not imply live tail parity — replay prefix is index-scoped, not the bounded WS tail.",
  selection_linked_change:
    "Does not imply cross-entity causality — only selection-scoped compare when ids match on both frames.",
  cluster_lanes_change:
    "Does not imply process tree or dependency edges — cluster lanes are bounded kind buckets only.",
  no_material_change:
    "Does not prove stability outside the compared bounded fields or beyond this baseline choice.",
};

function statusForEpisodeKind(
  ek: BoundedEpisodeKindV0,
  path: "replay" | "live",
  liveMut: "none" | "replace" | "append" | null,
  selectedSelectionId: string | null,
): BoundedClaimStatusV0 {
  if (ek === "insufficient_history") {
    return "unavailable";
  }
  if (ek === "settle") {
    return "weak";
  }
  if (ek === "tail_replace") {
    return path === "live" && liveMut === "replace" ? "observed" : "inferred_from_bounded_change";
  }
  if (ek === "tail_append") {
    return path === "live" && liveMut === "append" ? "observed" : "inferred_from_bounded_change";
  }
  if (ek === "tail_sample_shift") {
    return "inferred_from_bounded_change";
  }
  if (ek === "selection_cluster_delta" || ek === "focus_shift") {
    return selectedSelectionId ? "observed" : "weak";
  }
  if (ek === "cluster_lanes") {
    return "inferred_from_bounded_change";
  }
  return "observed";
}

function mapEpisodeToClaim(
  ep: BoundedEpisodeV0,
  index: number,
  path: "replay" | "live",
  liveMut: "none" | "replace" | "append" | null,
  selectedSelectionId: string | null,
  compareLine: string | null,
): BoundedClaimV0 {
  const baseRefs: string[] = [];
  if (compareLine) {
    baseRefs.push(`Compare: ${compareLine}`);
  }
  if (ep.compareHookLine && ep.compareHookLine !== compareLine) {
    baseRefs.push(ep.compareHookLine);
  }

  const id = `claim-v13:${ep.kind}:${index}`;

  const kindMap: Record<BoundedEpisodeKindV0, BoundedClaimKindV0> = {
    insufficient_history: "no_compare_baseline",
    resync_snapshot_rail: "reconcile_resync",
    warning_code: "warning_onset",
    http_reconcile: "reconcile_resync",
    wire_mode: "wire_mode_change",
    tail_replace: "replace_tail",
    tail_append: "append_growth",
    tail_sample_shift: "density_shift",
    replay_cursor_step: "replay_step_change",
    replay_prefix_fraction: "replay_step_change",
    selection_cluster_delta: "selection_linked_change",
    focus_shift: "selection_linked_change",
    cluster_lanes: "cluster_lanes_change",
    settle: "no_material_change",
  };

  const ck = kindMap[ep.kind];
  const status = statusForEpisodeKind(ep.kind, path, liveMut, selectedSelectionId);
  let statement = ep.summary;
  if (ep.kind === "insufficient_history") {
    statement =
      "Cannot state material bounded claims until a prior bounded frame exists for compare on this path.";
  }

  let honestyNote: string | null = ep.honestyNote;
  if (!honestyNote && status === "weak") {
    honestyNote =
      "Claim is shallow — bounded compare shows little or no selection-scoped delta.";
  }

  return {
    id,
    kind: ck,
    title: ep.title,
    statement,
    status,
    evidenceRefs: baseRefs,
    doesNotImply: DOES_NOT[ck],
    relatedEpisodeId: ep.id,
    suggestedSelectionId: ep.suggestedSelectionId,
    honestyNote,
  };
}

function drilldownEvidenceRefs(d: BoundedEvidenceDrilldownV0, max: number): string[] {
  const out: string[] = [];
  if (d.compareSummaryLine) {
    out.push(`Evidence compare: ${d.compareSummaryLine}`);
  }
  for (const f of d.facts) {
    if (out.length >= max) {
      break;
    }
    out.push(f);
  }
  return out;
}

export interface ComputeBoundedClaimsInput {
  path: "replay" | "live";
  /** Included for API symmetry; claim text uses compare + drilldown + episodes. */
  scene: GlassSceneV0;
  compare: BoundedSceneCompareV0;
  episodes: BoundedSceneEpisodesV0;
  drilldown: BoundedEvidenceDrilldownV0;
  selectedSelectionId: string | null;
  /** When set, primary highlight follows this episode’s linked claim. */
  selectedEpisodeId: string | null;
  liveEventTailMutation: "none" | "replace" | "append" | null;
}

/**
 * Build up to six bounded claims from the same inputs already shown in episodes + evidence.
 */
function mergeEvidenceRefs(a: readonly string[], b: readonly string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of [...a, ...b]) {
    if (out.length >= max) {
      break;
    }
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

export function computeBoundedSceneClaims(input: ComputeBoundedClaimsInput): BoundedSceneClaimsV0 {
  const { path, compare, episodes, drilldown, selectedSelectionId, selectedEpisodeId, liveEventTailMutation } =
    input;

  const drillRefs = mergeEvidenceRefs(
    [`Bounded sample scope: ${input.scene.honesty.sampleScope}`],
    drilldownEvidenceRefs(drilldown, 4),
    4,
  );
  const claimsOut: BoundedClaimV0[] = [];
  let i = 0;
  for (const ep of episodes.episodes) {
    if (claimsOut.length >= BOUNDED_CLAIM_CARD_MAX) {
      break;
    }
    const c = mapEpisodeToClaim(
      ep,
      i++,
      path,
      liveEventTailMutation,
      selectedSelectionId,
      compare.available ? compare.summaryLine : null,
    );
    const mergedRefs = mergeEvidenceRefs(c.evidenceRefs, drillRefs, 5);
    claimsOut.push({
      ...c,
      evidenceRefs: mergedRefs,
    });
  }

  const primaryClaimId = resolvePrimaryClaimId(claimsOut, selectedEpisodeId);

  return {
    kind: BOUNDED_CLAIMS_KIND,
    honestyLine: PACK_HONESTY,
    claims: claimsOut,
    primaryClaimId,
  };
}

export function resolvePrimaryClaimId(
  claims: readonly BoundedClaimV0[],
  selectedEpisodeId: string | null,
): string | null {
  if (claims.length === 0) {
    return null;
  }
  if (selectedEpisodeId) {
    const m = claims.find((c) => c.relatedEpisodeId === selectedEpisodeId);
    if (m) {
      return m.id;
    }
  }
  return claims[0]?.id ?? null;
}

export function boundedClaimSelectionStillValid(
  claims: readonly BoundedClaimV0[],
  selectedId: string | null,
): boolean {
  if (!selectedId) {
    return true;
  }
  return claims.some((c) => c.id === selectedId);
}

/** Receipt-style view for the selected claim — deterministic. */
export interface BoundedClaimReceiptV0 {
  readonly title: string;
  readonly statement: string;
  readonly statusLabel: string;
  readonly evidenceBullets: readonly string[];
  readonly doesNotImply: string;
  readonly scopeNote: string;
  /** Scene honesty line — same authority as Scene v0 footer. */
  readonly boundedSourceLine: string;
  readonly honestyNote: string | null;
}

function statusLabel(s: BoundedClaimStatusV0): string {
  switch (s) {
    case "observed":
      return "Observed (bounded frame)";
    case "inferred_from_bounded_change":
      return "Inferred from bounded field change";
    case "weak":
      return "Weak / shallow in this window";
    case "unavailable":
      return "Unavailable (insufficient bounded evidence)";
    default:
      return s;
  }
}

export function buildBoundedClaimReceipt(
  claim: BoundedClaimV0 | null,
  drilldown: BoundedEvidenceDrilldownV0,
  scene: GlassSceneV0,
): BoundedClaimReceiptV0 | null {
  if (!claim) {
    return null;
  }
  const bullets = [...claim.evidenceRefs];
  for (const r of drilldown.rows.slice(0, 2)) {
    const line = r.detailLine ? `${r.titleLine} — ${r.detailLine}` : r.titleLine;
    if (bullets.length < 6 && !bullets.includes(line)) {
      bullets.push(line);
    }
  }
  return {
    title: claim.title,
    statement: claim.statement,
    statusLabel: statusLabel(claim.status),
    evidenceBullets: bullets.slice(0, 6),
    doesNotImply: claim.doesNotImply,
    scopeNote: drilldown.scopeLine,
    boundedSourceLine: scene.honesty.line,
    honestyNote: claim.honestyNote,
  };
}

export function boundedClaimEvidenceUiLines(
  receipt: BoundedClaimReceiptV0 | null,
): { contextLine: string | null; doesNotImplyLine: string | null } {
  if (!receipt) {
    return { contextLine: null, doesNotImplyLine: null };
  }
  return {
    contextLine: `Bounded claim: ${receipt.title} — ${receipt.statement} (${receipt.statusLabel})`,
    doesNotImplyLine: `Does not imply: ${receipt.doesNotImply}`,
  };
}

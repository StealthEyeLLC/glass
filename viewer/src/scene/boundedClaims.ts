/**
 * Vertical Slice v13–v14 — bounded claims (pure, deterministic).
 * Explicit, evidence-stated claims from compare + drilldown + episodes — not AI, not causal topology.
 * v14: bounded receipt record (`glass.receipt.v0`) with mechanical claim↔evidence↔focus coupling.
 */

import { BOUNDED_SCENE_COMPARE_KIND, type BoundedSceneCompareV0 } from "./boundedSceneCompare.js";
import type { BoundedEvidenceDrilldownV0 } from "./boundedEvidenceDrilldown.js";
import type { BoundedEvidenceRowLabel } from "./boundedEvidenceDrilldown.js";
import type { BoundedSceneEpisodesV0, BoundedEpisodeKindV0, BoundedEpisodeV0 } from "./boundedEpisodes.js";
import type { GlassSceneV0 } from "./glassSceneV0.js";
import type { BoundedEvidenceRowKeyV0 } from "./boundedSceneCrosslink.js";

export const BOUNDED_CLAIMS_KIND = "glass.claims.v0" as const;

export const BOUNDED_RECEIPT_SCHEMA_VERSION = "glass.receipt.v0" as const;

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
  /** v14 — drilldown row indices that honestly support this claim kind. */
  readonly supportingEvidenceRowIndices: readonly number[];
  /** v14 — drilldown fact line indices used for support bullets. */
  readonly supportingFactIndices: readonly number[];
  /** v14 — deterministic ref tokens (`fact:n`, `row:n:…`) for receipts and tests. */
  readonly evidenceRefKeys: readonly string[];
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

/** Deterministic serial for evidence row keys — no hidden authority. */
export function serializeBoundedEvidenceRowKeyForReceipt(key: BoundedEvidenceRowKeyV0): string {
  if (key.kind === "none") {
    return "none";
  }
  if (key.kind === "live_tail_event") {
    return `live_tail:${key.tailIndex}`;
  }
  return `replay:${key.seq}:${key.event_id}`;
}

function fnv1a32Hex(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function computeSupportingRowIndices(
  claimKind: BoundedClaimKindV0,
  rows: readonly { rowLabel: BoundedEvidenceRowLabel }[],
): number[] {
  if (claimKind === "no_compare_baseline") {
    return [];
  }
  const scored: { i: number; score: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const rl = rows[i].rowLabel;
    let score = 0;
    switch (claimKind) {
      case "replay_step_change":
        if (rl === "current_step") {
          score = 3;
        } else if (rl === "replay_prefix") {
          score = 2;
        }
        break;
      case "replace_tail":
      case "append_growth":
      case "density_shift":
        if (rl === "changed") {
          score = 3;
        } else if (rl === "live_tail" || rl === "replay_prefix") {
          score = 2;
        }
        break;
      case "selection_linked_change":
      case "cluster_lanes_change":
        if (rl === "sampled") {
          score = 3;
        } else if (rl === "changed") {
          score = 2;
        } else if (rl === "live_tail") {
          score = 1;
        }
        break;
      case "warning_onset":
      case "reconcile_resync":
        if (rl === "live_tail" || rl === "replay_prefix") {
          score = 2;
        }
        break;
      case "wire_mode_change":
        if (rl === "current_step") {
          score = 3;
        } else if (rl === "live_tail" || rl === "replay_prefix") {
          score = 2;
        }
        break;
      case "no_material_change":
        if (rl === "changed") {
          score = 2;
        } else if (rl === "live_tail" || rl === "replay_prefix") {
          score = 1;
        }
        break;
      default:
        score = 0;
    }
    if (score > 0) {
      scored.push({ i, score });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  let picked = scored.map((s) => s.i).slice(0, 6);
  if (picked.length === 0 && rows.length > 0) {
    picked = [rows.length - 1];
  }
  return picked;
}

function computeSupportingFactIndices(
  claimKind: BoundedClaimKindV0,
  facts: readonly string[],
  claimStatus: BoundedClaimStatusV0,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < facts.length; i++) {
    const f = facts[i];
    if (!f) {
      continue;
    }
    if (claimKind === "warning_onset" && /warning|resync|reconcile/i.test(f)) {
      out.push(i);
    } else if (
      claimKind === "reconcile_resync" &&
      /reconcile|resync|snapshot_origin|HTTP/i.test(f)
    ) {
      out.push(i);
    } else if (claimKind === "wire_mode_change" && /wire|mode|lane/i.test(f)) {
      out.push(i);
    } else if (
      claimKind === "no_compare_baseline" &&
      /sample scope|compare|prior|bounded/i.test(f)
    ) {
      out.push(i);
    }
  }
  if (out.length === 0) {
    if (claimKind === "no_compare_baseline" || claimStatus === "unavailable") {
      return facts.length > 0 ? [0] : [];
    }
    for (let i = 0; i < Math.min(3, facts.length); i++) {
      out.push(i);
    }
  }
  return [...new Set(out)].sort((a, b) => a - b).slice(0, 6);
}

function buildEvidenceRefKeys(
  drilldown: BoundedEvidenceDrilldownV0,
  rowIdx: readonly number[],
  factIdx: readonly number[],
): string[] {
  const keys: string[] = [];
  for (const fi of factIdx) {
    keys.push(`fact:${fi}`);
  }
  for (const ri of rowIdx) {
    const row = drilldown.rows[ri];
    if (row) {
      keys.push(`row:${ri}:${serializeBoundedEvidenceRowKeyForReceipt(row.rowKey)}`);
    }
  }
  return keys;
}

function mapEpisodeToClaim(
  ep: BoundedEpisodeV0,
  index: number,
  path: "replay" | "live",
  liveMut: "none" | "replace" | "append" | null,
  selectedSelectionId: string | null,
  compareLine: string | null,
  drilldown: BoundedEvidenceDrilldownV0,
): BoundedClaimV0 {
  const baseRefs: string[] = [];
  if (compareLine) {
    baseRefs.push(`Compare: ${compareLine}`);
  }
  if (ep.compareHookLine && ep.compareHookLine !== compareLine) {
    baseRefs.push(ep.compareHookLine);
  }

  const id = `claim-v14:${ep.kind}:${index}`;

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

  const rowIdx = computeSupportingRowIndices(ck, drilldown.rows);
  const factIdx = computeSupportingFactIndices(ck, drilldown.facts, status);
  const evidenceRefKeys = buildEvidenceRefKeys(drilldown, rowIdx, factIdx);

  return {
    id,
    kind: ck,
    title: ep.title,
    statement,
    status,
    evidenceRefs: baseRefs,
    supportingEvidenceRowIndices: rowIdx,
    supportingFactIndices: factIdx,
    evidenceRefKeys,
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
      drilldown,
    );
    const mergedRefs = mergeEvidenceRefs(c.evidenceRefs, drillRefs, 5);
    claimsOut.push({
      ...c,
      evidenceRefs: mergedRefs,
    });
  }

  const primaryClaimId = resolvePrimaryClaimId(claimsOut, selectedEpisodeId, selectedSelectionId);

  return {
    kind: BOUNDED_CLAIMS_KIND,
    honestyLine: PACK_HONESTY,
    claims: claimsOut,
    primaryClaimId,
  };
}

/**
 * Primary claim: selected episode wins; then cluster selection may prefer selection/cluster claims;
 * else first claim.
 */
export function resolvePrimaryClaimId(
  claims: readonly BoundedClaimV0[],
  selectedEpisodeId: string | null,
  selectedSelectionId: string | null = null,
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
  if (selectedSelectionId?.includes(":cluster:")) {
    const selLinked = claims.find(
      (c) => c.kind === "selection_linked_change" || c.kind === "cluster_lanes_change",
    );
    if (selLinked) {
      return selLinked.id;
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

function buildSupportBullets(
  claim: BoundedClaimV0,
  drilldown: BoundedEvidenceDrilldownV0,
  compare: BoundedSceneCompareV0,
): string[] {
  const out: string[] = [];
  if (compare.available && compare.summaryLine) {
    out.push(`Compare: ${compare.summaryLine}`);
  }
  for (const fi of claim.supportingFactIndices) {
    const f = drilldown.facts[fi];
    if (f) {
      out.push(`Fact[${fi}]: ${f}`);
    }
  }
  for (const ri of claim.supportingEvidenceRowIndices) {
    const r = drilldown.rows[ri];
    if (r) {
      const line = r.detailLine ? `${r.titleLine} — ${r.detailLine}` : r.titleLine;
      out.push(`Evidence row[${ri}] (${r.rowLabel}): ${line}`);
    }
  }
  if (out.length === 0) {
    if (claim.status === "unavailable") {
      out.push(
        "No compare baseline on this path — bounded evidence rows do not support material claims yet.",
      );
    } else {
      out.push("No matching bounded evidence rows in this drilldown — see scope and facts above.");
    }
  }
  return out.slice(0, 8);
}

function buildFocusContextLine(
  drilldown: BoundedEvidenceDrilldownV0,
  selectedEpisodeId: string | null,
  episodes: BoundedSceneEpisodesV0 | null,
): string | null {
  const parts: string[] = [];
  if (drilldown.selectedTargetSummary) {
    parts.push(`Selection: ${drilldown.selectedTargetSummary}`);
  }
  if (selectedEpisodeId && episodes) {
    const ep = episodes.episodes.find((e) => e.id === selectedEpisodeId);
    if (ep) {
      parts.push(`Episode: ${ep.title}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

function receiptFingerprint(
  claim: BoundedClaimV0,
  drilldown: BoundedEvidenceDrilldownV0,
  scene: GlassSceneV0,
): string {
  return [
    claim.id,
    claim.kind,
    drilldown.scopeLine,
    scene.honesty.sampleScope,
    claim.supportingEvidenceRowIndices.join(","),
    claim.supportingFactIndices.join(","),
  ].join("|");
}

/** Receipt-style bounded record — deterministic, evidence-coupled (v14). */
export interface BoundedClaimReceiptV0 {
  readonly schemaVersion: typeof BOUNDED_RECEIPT_SCHEMA_VERSION;
  readonly receiptId: string;
  readonly claimId: string;
  readonly claimKind: BoundedClaimKindV0;
  readonly title: string;
  readonly statement: string;
  readonly statusLabel: string;
  /** Ordered support lines tied to compare, facts, and evidence rows. */
  readonly supportBullets: readonly string[];
  readonly evidenceFactIndices: readonly number[];
  readonly evidenceRowIndices: readonly number[];
  readonly evidenceRefKeys: readonly string[];
  readonly compareAnchorLine: string | null;
  readonly scopeNote: string;
  /** Scene honesty line — same authority as Scene v0 footer. */
  readonly boundedSourceLine: string;
  readonly focusContextLine: string | null;
  readonly doesNotImply: string;
  readonly weaknessOrUnavailableNote: string | null;
}

export interface BuildBoundedClaimReceiptContext {
  compare: BoundedSceneCompareV0;
  selectedSelectionId: string | null;
  selectedEpisodeId: string | null;
  episodes: BoundedSceneEpisodesV0 | null;
}

export function buildBoundedClaimReceipt(
  claim: BoundedClaimV0 | null,
  drilldown: BoundedEvidenceDrilldownV0,
  scene: GlassSceneV0,
  ctx?: BuildBoundedClaimReceiptContext,
): BoundedClaimReceiptV0 | null {
  if (!claim) {
    return null;
  }
  const compareStub: BoundedSceneCompareV0 = ctx?.compare ?? {
    kind: BOUNDED_SCENE_COMPARE_KIND,
    available: false,
    unavailableReason: null,
    summaryLine: null,
    detailLines: [],
    hints: {
      wireModeChanged: false,
      densityOrTailChanged: false,
      snapshotOriginChanged: false,
      reconcileChanged: false,
      resyncReasonChanged: false,
      warningChanged: false,
      replayPrefixChanged: false,
      railSignalsChanged: false,
      clusterIdsWithBoundedDelta: [],
      regionWeightsChanged: false,
      emphasisStepsChanged: false,
      focusTargetChanged: false,
    },
    selectionCompareLine: null,
  };
  const supportBullets = buildSupportBullets(claim, drilldown, compareStub);
  const fp = receiptFingerprint(claim, drilldown, scene);
  const receiptId = `receipt-v14:${claim.id}:${fnv1a32Hex(fp)}`;
  const compareAnchorLine = compareStub.available ? compareStub.summaryLine : null;
  const focusContextLine = buildFocusContextLine(
    drilldown,
    ctx?.selectedEpisodeId ?? null,
    ctx?.episodes ?? null,
  );

  let weaknessOrUnavailableNote: string | null = claim.honestyNote;
  if (!weaknessOrUnavailableNote && claim.status === "unavailable") {
    weaknessOrUnavailableNote =
      "Compare baseline is missing — this receipt cannot assert material bounded change.";
  }

  return {
    schemaVersion: BOUNDED_RECEIPT_SCHEMA_VERSION,
    receiptId,
    claimId: claim.id,
    claimKind: claim.kind,
    title: claim.title,
    statement: claim.statement,
    statusLabel: statusLabel(claim.status),
    supportBullets,
    evidenceFactIndices: claim.supportingFactIndices,
    evidenceRowIndices: claim.supportingEvidenceRowIndices,
    evidenceRefKeys: claim.evidenceRefKeys,
    compareAnchorLine,
    scopeNote: drilldown.scopeLine,
    boundedSourceLine: scene.honesty.line,
    focusContextLine,
    doesNotImply: claim.doesNotImply,
    weaknessOrUnavailableNote,
  };
}

export function boundedClaimEvidenceUiLines(
  receipt: BoundedClaimReceiptV0 | null,
): { contextLine: string | null; doesNotImplyLine: string | null } {
  if (!receipt) {
    return { contextLine: null, doesNotImplyLine: null };
  }
  return {
    contextLine: `${receipt.receiptId} · Bounded claim: ${receipt.title} — ${receipt.statement} (${receipt.statusLabel})`,
    doesNotImplyLine: `Does not imply: ${receipt.doesNotImply}`,
  };
}

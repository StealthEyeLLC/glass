/**
 * DOM rendering for Vertical Slice v9–v16 bounded evidence drilldown — thin view over pure model output.
 */

import { VERTICAL_SLICE_V28_EVIDENCE_LEAD } from "../app/verticalSliceV0.js";
import type { GlassSceneV0 } from "./glassSceneV0.js";
import type { GlassEvent } from "../pack/types.js";
import type { LiveVisualSpec } from "../live/liveVisualModel.js";
import type { BoundedEvidenceDrilldownV0 } from "./boundedEvidenceDrilldown.js";
import type { BoundedEvidenceRowLabel } from "./boundedEvidenceDrilldown.js";
import {
  evidenceRowLinkedToSelection,
  resolveCompareEvidenceCrosslink,
  resolveEvidenceRowKeyToSelection,
  type BoundedCrosslinkResolutionV0,
} from "./boundedSceneCrosslink.js";

export interface RenderBoundedEvidenceOptions {
  scene: GlassSceneV0;
  selectedSelectionId: string | null;
  liveEventTail: readonly unknown[] | null;
  replayEvents: readonly GlassEvent[] | null;
  /** Latest spec — used only for compare-line cross-link targets. */
  liveVisualSpec: LiveVisualSpec;
  /** Vertical Slice v12 — selected bounded episode context (rule-based, not causal history). */
  episodeContextLine?: string | null;
  episodeHonestyNote?: string | null;
  /** Vertical Slice v13 — active bounded claim (receipt summary lines). */
  claimContextLine?: string | null;
  claimDoesNotImplyLine?: string | null;
  /** Vertical Slice v14 — highlight evidence rows that mechanically support the active claim. */
  supportingEvidenceRowIndices?: readonly number[] | null;
  /** Replace-selection on row; toggle off when activating the same mapped id as current. */
  onActivateRow?: (rowIndex: number, resolution: BoundedCrosslinkResolutionV0) => void;
  onActivateCompare?: (resolution: BoundedCrosslinkResolutionV0) => void;
}

/** Calm display caption for row label tokens — bounded vocabulary only. */
export function boundedEvidenceRowLabelCaption(label: BoundedEvidenceRowLabel): string {
  switch (label) {
    case "live_tail":
      return "Live tail sample";
    case "replay_prefix":
      return "Replay prefix";
    case "current_step":
      return "Current replay step";
    case "changed":
      return "Changed vs prior frame";
    case "sampled":
      return "Cluster-filtered sample";
    case "fact_only":
      return "Fact line";
    default:
      return label;
  }
}

function attachCrosslinkActivate(
  el: HTMLElement,
  fn: () => void,
): void {
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  el.addEventListener("click", (e) => {
    e.preventDefault();
    fn();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  });
}

export function renderBoundedEvidenceInto(
  container: HTMLElement,
  drilldown: BoundedEvidenceDrilldownV0,
  options?: RenderBoundedEvidenceOptions,
): void {
  container.replaceChildren();

  const trust = document.createElement("div");
  trust.className = "glass-bounded-evidence-trust";
  trust.setAttribute("data-testid", "glass-bounded-evidence-trust");

  const lead = document.createElement("p");
  lead.className = "glass-bounded-evidence-lead";
  lead.setAttribute("data-testid", "glass-bounded-evidence-lead");
  lead.textContent = VERTICAL_SLICE_V28_EVIDENCE_LEAD;
  trust.appendChild(lead);

  const authorityDetails = document.createElement("details");
  authorityDetails.className = "glass-trust-technical glass-bounded-evidence-authority-details";
  authorityDetails.setAttribute("data-testid", "glass-bounded-evidence-authority-technical");
  const authSum = document.createElement("summary");
  authSum.className = "glass-trust-technical-summary";
  authSum.textContent = "Exact scope & limits";

  const authority = document.createElement("section");
  authority.className = "glass-bounded-evidence-section glass-bounded-evidence-section--authority";

  const kAuthority = document.createElement("span");
  kAuthority.className = "glass-bounded-evidence-kicker";
  kAuthority.textContent = "What this covers";

  const scope = document.createElement("p");
  scope.className = "glass-bounded-evidence-scope";
  scope.textContent = drilldown.scopeLine;

  const kHon = document.createElement("span");
  kHon.className = "glass-bounded-evidence-kicker";
  kHon.textContent = "Technical limits";

  const hon = document.createElement("p");
  hon.className = "glass-bounded-evidence-honesty";
  hon.textContent = drilldown.honestyLine;

  authority.append(kAuthority, scope, kHon, hon);
  authorityDetails.append(authSum, authority);
  trust.appendChild(authorityDetails);

  const context = document.createElement("div");
  context.className = "glass-bounded-evidence-context";

  if (drilldown.selectedTargetSummary) {
    const p = document.createElement("p");
    p.className = "glass-bounded-evidence-selected";
    p.textContent = `Selection: ${drilldown.selectedTargetSummary}`;
    context.appendChild(p);
  }

  if (drilldown.compareSummaryLine) {
    const p = document.createElement("p");
    p.className = "glass-bounded-evidence-compare";
    p.textContent = drilldown.compareSummaryLine;
    if (options?.onActivateCompare && options.liveVisualSpec) {
      const cmpRes = resolveCompareEvidenceCrosslink(options.liveVisualSpec);
      if (cmpRes.targetSelectionId) {
        p.classList.add("glass-bounded-evidence-compare--linked");
        attachCrosslinkActivate(p, () => {
          options.onActivateCompare?.(cmpRes);
        });
      }
    }
    context.appendChild(p);
  }

  if (drilldown.compareEvidenceNote) {
    const p = document.createElement("p");
    p.className = "glass-bounded-evidence-compare-note";
    p.textContent = drilldown.compareEvidenceNote;
    context.appendChild(p);
  }

  if (context.childNodes.length > 0) {
    trust.appendChild(context);
  }

  if (options?.episodeContextLine || options?.episodeHonestyNote || options?.claimContextLine || options?.claimDoesNotImplyLine) {
    const align = document.createElement("div");
    align.className = "glass-bounded-evidence-alignment";
    if (options?.episodeContextLine) {
      const p = document.createElement("p");
      p.className = "glass-bounded-evidence-episode";
      p.setAttribute("data-testid", "bounded-evidence-episode-context");
      p.textContent = options.episodeContextLine;
      align.appendChild(p);
    }
    if (options?.claimContextLine) {
      const p = document.createElement("p");
      p.className = "glass-bounded-evidence-claim";
      p.setAttribute("data-testid", "bounded-evidence-claim-context");
      p.textContent = options.claimContextLine;
      align.appendChild(p);
    }
    if (options?.episodeHonestyNote || options?.claimDoesNotImplyLine) {
      const fine = document.createElement("details");
      fine.className = "glass-trust-technical";
      fine.setAttribute("data-testid", "glass-bounded-evidence-alignment-technical");
      const fineSum = document.createElement("summary");
      fineSum.className = "glass-trust-technical-summary";
      fineSum.textContent = "Story-card & claim fine print";
      if (options?.episodeHonestyNote) {
        const p = document.createElement("p");
        p.className = "glass-bounded-evidence-episode-honesty";
        p.setAttribute("data-testid", "bounded-evidence-episode-honesty");
        p.textContent = options.episodeHonestyNote;
        fine.appendChild(p);
      }
      if (options?.claimDoesNotImplyLine) {
        const p = document.createElement("p");
        p.className = "glass-bounded-evidence-claim-not";
        p.setAttribute("data-testid", "bounded-evidence-claim-not");
        p.textContent = options.claimDoesNotImplyLine;
        fine.appendChild(p);
      }
      align.appendChild(fine);
    }
    trust.appendChild(align);
  }

  if (drilldown.facts.length > 0) {
    const sec = document.createElement("section");
    sec.className = "glass-bounded-evidence-section";
    const h = document.createElement("span");
    h.className = "glass-bounded-evidence-section-heading";
    h.textContent = "Facts";
    const ul = document.createElement("ul");
    ul.className = "glass-bounded-evidence-facts";
    for (const f of drilldown.facts) {
      const li = document.createElement("li");
      li.textContent = f;
      ul.appendChild(li);
    }
    sec.append(h, ul);
    trust.appendChild(sec);
  }

  if (drilldown.rows.length > 0) {
    const sec = document.createElement("section");
    sec.className = "glass-bounded-evidence-section";
    const h = document.createElement("span");
    h.className = "glass-bounded-evidence-rows-label";
    h.textContent = "Event rows";
    const wrap = document.createElement("div");
    wrap.className = "glass-bounded-evidence-rows";
    const supportSet =
      options?.supportingEvidenceRowIndices !== undefined && options.supportingEvidenceRowIndices !== null
        ? new Set(options.supportingEvidenceRowIndices)
        : null;

    drilldown.rows.forEach((r, rowIndex) => {
      const card = document.createElement("div");
      card.className = "glass-bounded-evidence-card";
      card.dataset.evidenceRowIndex = String(rowIndex);
      card.dataset.rowLabel = r.rowLabel;
      if (supportSet?.has(rowIndex)) {
        card.classList.add("glass-bounded-evidence-card--claim-support");
        card.dataset.claimSupport = "true";
      }

      let resolution: BoundedCrosslinkResolutionV0 | null = null;
      if (options) {
        resolution = resolveEvidenceRowKeyToSelection(options.scene, r.rowKey, {
          liveEventTail: options.liveEventTail,
          replayEvents: options.replayEvents,
        });
        if (resolution.targetSelectionId) {
          card.classList.add("glass-bounded-evidence-card--linked");
          card.dataset.crosslinkTarget = resolution.targetSelectionId;
        }
        if (evidenceRowLinkedToSelection(resolution, options.selectedSelectionId)) {
          card.dataset.selected = "true";
        }
      }

      const head = document.createElement("div");
      head.className = "glass-bounded-evidence-card-head";

      const lab = document.createElement("span");
      lab.className = "glass-bounded-evidence-card-label";
      lab.textContent = r.rowLabel;

      const human = document.createElement("span");
      human.className = "glass-bounded-evidence-card-label-human";
      human.textContent = boundedEvidenceRowLabelCaption(r.rowLabel);

      head.append(lab, human);

      const title = document.createElement("div");
      title.className = "glass-bounded-evidence-card-title";
      title.textContent = r.titleLine;
      card.append(head, title);
      if (r.detailLine) {
        const det = document.createElement("div");
        det.className = "glass-bounded-evidence-card-detail";
        det.textContent = r.detailLine;
        card.appendChild(det);
      }

      if (options?.onActivateRow && resolution !== null) {
        const res = resolution;
        attachCrosslinkActivate(card, () => {
          options.onActivateRow?.(rowIndex, res);
        });
      }

      wrap.appendChild(card);
    });
    sec.append(h, wrap);
    trust.appendChild(sec);
  }

  container.appendChild(trust);
}

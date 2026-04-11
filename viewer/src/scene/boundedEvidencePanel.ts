/**
 * DOM rendering for Vertical Slice v9–v10 bounded evidence drilldown — thin view over pure model output.
 */

import type { GlassSceneV0 } from "./glassSceneV0.js";
import type { GlassEvent } from "../pack/types.js";
import type { LiveVisualSpec } from "../live/liveVisualModel.js";
import type { BoundedEvidenceDrilldownV0 } from "./boundedEvidenceDrilldown.js";
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
  /** Replace-selection on row; toggle off when activating the same mapped id as current. */
  onActivateRow?: (rowIndex: number, resolution: BoundedCrosslinkResolutionV0) => void;
  onActivateCompare?: (resolution: BoundedCrosslinkResolutionV0) => void;
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

  const scope = document.createElement("p");
  scope.className = "glass-bounded-evidence-scope";
  scope.textContent = drilldown.scopeLine;

  const hon = document.createElement("p");
  hon.className = "glass-bounded-evidence-honesty";
  hon.textContent = drilldown.honestyLine;

  container.append(scope, hon);

  if (drilldown.selectedTargetSummary) {
    const p = document.createElement("p");
    p.className = "glass-bounded-evidence-selected";
    p.textContent = `Selected: ${drilldown.selectedTargetSummary}`;
    container.appendChild(p);
  }

  if (drilldown.compareSummaryLine) {
    const p = document.createElement("p");
    p.className = "glass-bounded-evidence-compare";
    p.textContent = `Compare: ${drilldown.compareSummaryLine}`;
    if (options?.onActivateCompare && options.liveVisualSpec) {
      const cmpRes = resolveCompareEvidenceCrosslink(options.liveVisualSpec);
      if (cmpRes.targetSelectionId) {
        p.classList.add("glass-bounded-evidence-compare--linked");
        attachCrosslinkActivate(p, () => {
          options.onActivateCompare?.(cmpRes);
        });
      }
    }
    container.appendChild(p);
  }

  if (drilldown.compareEvidenceNote) {
    const p = document.createElement("p");
    p.className = "glass-bounded-evidence-compare-note";
    p.textContent = drilldown.compareEvidenceNote;
    container.appendChild(p);
  }

  if (options?.episodeContextLine) {
    const p = document.createElement("p");
    p.className = "glass-bounded-evidence-episode";
    p.setAttribute("data-testid", "bounded-evidence-episode-context");
    p.textContent = options.episodeContextLine;
    container.appendChild(p);
  }
  if (options?.episodeHonestyNote) {
    const p = document.createElement("p");
    p.className = "glass-bounded-evidence-episode-honesty";
    p.setAttribute("data-testid", "bounded-evidence-episode-honesty");
    p.textContent = options.episodeHonestyNote;
    container.appendChild(p);
  }

  if (drilldown.facts.length > 0) {
    const ul = document.createElement("ul");
    ul.className = "glass-bounded-evidence-facts";
    for (const f of drilldown.facts) {
      const li = document.createElement("li");
      li.textContent = f;
      ul.appendChild(li);
    }
    container.appendChild(ul);
  }

  if (drilldown.rows.length > 0) {
    const wrap = document.createElement("div");
    wrap.className = "glass-bounded-evidence-rows";
    drilldown.rows.forEach((r, rowIndex) => {
      const card = document.createElement("div");
      card.className = "glass-bounded-evidence-card";
      card.dataset.evidenceRowIndex = String(rowIndex);

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

      const lab = document.createElement("span");
      lab.className = "glass-bounded-evidence-card-label";
      lab.textContent = r.rowLabel;
      const title = document.createElement("div");
      title.className = "glass-bounded-evidence-card-title";
      title.textContent = r.titleLine;
      card.append(lab, title);
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
    container.appendChild(wrap);
  }
}

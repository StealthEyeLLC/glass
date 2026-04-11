/**
 * DOM rendering for Vertical Slice v9 bounded evidence drilldown — thin view over pure model output.
 */

import type { BoundedEvidenceDrilldownV0 } from "./boundedEvidenceDrilldown.js";

export function renderBoundedEvidenceInto(
  container: HTMLElement,
  drilldown: BoundedEvidenceDrilldownV0,
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
    container.appendChild(p);
  }

  if (drilldown.compareEvidenceNote) {
    const p = document.createElement("p");
    p.className = "glass-bounded-evidence-compare-note";
    p.textContent = drilldown.compareEvidenceNote;
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
    for (const r of drilldown.rows) {
      const card = document.createElement("div");
      card.className = "glass-bounded-evidence-card";
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
      wrap.appendChild(card);
    }
    container.appendChild(wrap);
  }
}

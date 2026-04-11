/**
 * DOM for Vertical Slice v11 bounded temporal lens — thin view over pure model output.
 */

import type { BoundedTemporalLensViewV0 } from "./boundedTemporalLens.js";

export interface BoundedTemporalLensPanelHandlers {
  /** Replay: seek to event index. */
  onSeekReplayStep?: (eventIndex: number) => void;
  /** Set compare baseline to this ring index (not current). */
  onSelectBaseline?: (ringIndex: number) => void;
  onResetBaseline?: () => void;
}

export function renderBoundedTemporalLensInto(
  container: HTMLElement,
  view: BoundedTemporalLensViewV0,
  handlers: BoundedTemporalLensPanelHandlers,
): void {
  container.replaceChildren();

  const hon = document.createElement("p");
  hon.className = "glass-bounded-temporal-honesty";
  hon.textContent = view.honesty.line;

  const note = document.createElement("p");
  note.className = "glass-bounded-temporal-baseline-note";
  note.setAttribute("data-testid", "bounded-temporal-baseline-note");
  if (view.baselineHonestyNote) {
    note.textContent = view.baselineHonestyNote;
    note.style.display = "";
  } else {
    note.textContent = "";
    note.style.display = "none";
  }

  container.append(hon, note);

  if (view.stepChips.length > 0) {
    const row = document.createElement("div");
    row.className = "glass-bounded-temporal-steps";
    row.setAttribute("data-testid", "bounded-temporal-step-row");
    const lab = document.createElement("span");
    lab.className = "glass-bounded-temporal-row-label";
    lab.textContent = "Steps (bounded):";
    row.appendChild(lab);
    for (const c of view.stepChips) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "glass-bounded-temporal-chip";
      if (c.isCurrent) {
        b.dataset.current = "true";
      }
      b.textContent = `#${c.displayOrdinal}`;
      b.title = `Seek to index ${c.eventIndex} (bounded pack prefix)`;
      b.setAttribute("data-testid", "bounded-temporal-step-chip");
      b.addEventListener("click", () => {
        handlers.onSeekReplayStep?.(c.eventIndex);
      });
      row.appendChild(b);
    }
    container.appendChild(row);
  }

  if (view.ringEntries.length > 0) {
    const row = document.createElement("div");
    row.className = "glass-bounded-temporal-ring";
    row.setAttribute("data-testid", "bounded-temporal-ring-row");
    const lab = document.createElement("span");
    lab.className = "glass-bounded-temporal-row-label";
    lab.textContent = "Recent paints:";
    row.appendChild(lab);
    for (const e of view.ringEntries) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "glass-bounded-temporal-chip glass-bounded-temporal-chip--paint";
      if (e.isCurrent) {
        b.dataset.current = "true";
      }
      if (e.isActiveBaseline) {
        b.dataset.baseline = "true";
      }
      b.textContent = e.isCurrent ? `Now · ${e.fingerprint}` : e.fingerprint;
      b.title = e.isCurrent
        ? "Current bounded frame"
        : "Use this paint as compare baseline (vs current)";
      b.setAttribute("data-testid", "bounded-temporal-paint-chip");
      if (!e.isCurrent) {
        b.addEventListener("click", () => {
          handlers.onSelectBaseline?.(e.ringIndex);
        });
      }
      row.appendChild(b);
    }
    container.appendChild(row);
  }

  if (view.showResetBaseline && handlers.onResetBaseline) {
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "glass-bounded-temporal-reset";
    reset.textContent = "Reset compare baseline (use immediate prior paint)";
    reset.setAttribute("data-testid", "bounded-temporal-reset-baseline");
    reset.addEventListener("click", () => {
      handlers.onResetBaseline();
    });
    container.appendChild(reset);
  }
}

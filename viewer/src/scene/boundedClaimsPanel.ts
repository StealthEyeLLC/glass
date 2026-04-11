/**
 * DOM for Vertical Slice v13 bounded claims + receipt — thin view over pure model output.
 */

import type { BoundedClaimReceiptV0, BoundedClaimV0, BoundedSceneClaimsV0 } from "./boundedClaims.js";

export interface RenderBoundedClaimsOptions {
  testIdPrefix: "replay" | "live";
  /** Resolved highlight: explicit selection or primary. */
  highlightClaimId: string | null;
  onSelectClaim: (nextSelectedId: string | null, claim: BoundedClaimV0) => void;
}

export function renderBoundedClaimsInto(
  container: HTMLElement,
  pack: BoundedSceneClaimsV0,
  options: RenderBoundedClaimsOptions,
): void {
  container.replaceChildren();

  const hon = document.createElement("p");
  hon.className = "glass-bounded-claims-honesty";
  hon.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claims-honesty`);
  hon.textContent = pack.honestyLine;

  const row = document.createElement("div");
  row.className = "glass-bounded-claims-row";
  row.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claims-row`);

  for (const c of pack.claims) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "glass-bounded-claim-chip";
    chip.dataset.claimId = c.id;
    chip.dataset.claimKind = c.kind;
    chip.dataset.status = c.status;
    if (options.highlightClaimId === c.id) {
      chip.classList.add("glass-bounded-claim-chip--selected");
    }
    chip.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-chip`);

    const title = document.createElement("span");
    title.className = "glass-bounded-claim-chip-title";
    title.textContent = c.title;

    const st = document.createElement("span");
    st.className = "glass-bounded-claim-chip-status";
    st.textContent = c.status.replace(/_/g, " ");

    chip.append(title, st);
    chip.addEventListener("click", () => {
      const next = options.highlightClaimId === c.id ? null : c.id;
      options.onSelectClaim(next, c);
    });
    row.appendChild(chip);
  }

  container.append(hon, row);
}

export function renderBoundedClaimReceiptInto(
  container: HTMLElement,
  receipt: BoundedClaimReceiptV0 | null,
  options: { testIdPrefix: "replay" | "live" },
): void {
  container.replaceChildren();
  if (!receipt) {
    const empty = document.createElement("p");
    empty.className = "glass-bounded-claim-receipt-empty";
    empty.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-receipt-empty`);
    empty.textContent = "No claim receipt — select a bounded claim chip or episode.";
    container.appendChild(empty);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "glass-bounded-claim-receipt";
  wrap.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-receipt`);

  const h = document.createElement("div");
  h.className = "glass-bounded-claim-receipt-title";
  h.textContent = receipt.title;

  const st = document.createElement("div");
  st.className = "glass-bounded-claim-receipt-status";
  st.textContent = receipt.statusLabel;

  const p = document.createElement("p");
  p.className = "glass-bounded-claim-receipt-statement";
  p.textContent = receipt.statement;

  const scope = document.createElement("p");
  scope.className = "glass-bounded-claim-receipt-scope";
  scope.textContent = `Scope: ${receipt.scopeNote}`;

  const src = document.createElement("p");
  src.className = "glass-bounded-claim-receipt-source";
  src.textContent = `Source: ${receipt.boundedSourceLine}`;

  const not = document.createElement("p");
  not.className = "glass-bounded-claim-receipt-not";
  not.textContent = `Does not imply: ${receipt.doesNotImply}`;

  const ul = document.createElement("ul");
  ul.className = "glass-bounded-claim-receipt-bullets";
  ul.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-receipt-bullets`);
  for (const b of receipt.evidenceBullets) {
    const li = document.createElement("li");
    li.textContent = b;
    ul.appendChild(li);
  }

  wrap.append(h, st, p, scope, src, not, ul);

  if (receipt.honestyNote) {
    const hn = document.createElement("p");
    hn.className = "glass-bounded-claim-receipt-honesty";
    hn.textContent = receipt.honestyNote;
    wrap.appendChild(hn);
  }

  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "glass-bounded-claim-receipt-copy";
  copyBtn.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-receipt-copy`);
  copyBtn.textContent = "Copy claim receipt (text)";
  copyBtn.addEventListener("click", () => {
    const text = [
      receipt.title,
      receipt.statusLabel,
      receipt.statement,
      `Scope: ${receipt.scopeNote}`,
      `Source: ${receipt.boundedSourceLine}`,
      `Does not imply: ${receipt.doesNotImply}`,
      "Evidence:",
      ...receipt.evidenceBullets.map((x) => `• ${x}`),
      receipt.honestyNote ? `Note: ${receipt.honestyNote}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    void navigator.clipboard.writeText(text).catch(() => {});
  });

  wrap.appendChild(copyBtn);
  container.appendChild(wrap);
}

/**
 * DOM for Vertical Slice v13–v16 bounded claims + receipt — thin view over pure model output.
 */

import {
  formatBoundedClaimChipStatusShort,
  type BoundedClaimReceiptV0,
  type BoundedClaimV0,
  type BoundedSceneClaimsV0,
} from "./boundedClaims.js";

export interface RenderBoundedClaimsOptions {
  testIdPrefix: "replay" | "live";
  /** Resolved highlight: explicit selection or primary. */
  highlightClaimId: string | null;
  onSelectClaim: (nextSelectedId: string | null, claim: BoundedClaimV0) => void;
}

function claimChipStatusClass(status: BoundedClaimV0["status"]): string | null {
  if (status === "unavailable") {
    return "glass-bounded-claim-chip--status-unavailable";
  }
  if (status === "weak") {
    return "glass-bounded-claim-chip--status-weak";
  }
  return null;
}

function receiptTrustTier(receipt: BoundedClaimReceiptV0): "unavailable" | "weak" | "firm" {
  if (receipt.statusLabel.includes("Unavailable")) {
    return "unavailable";
  }
  if (receipt.statusLabel.includes("Weak")) {
    return "weak";
  }
  return "firm";
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
    const stCls = claimChipStatusClass(c.status);
    if (stCls) {
      chip.classList.add(stCls);
    }
    if (options.highlightClaimId === c.id) {
      chip.classList.add("glass-bounded-claim-chip--selected");
    }
    chip.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-chip`);

    const title = document.createElement("span");
    title.className = "glass-bounded-claim-chip-title";
    title.textContent = c.title;

    const st = document.createElement("span");
    st.className = "glass-bounded-claim-chip-status";
    st.textContent = formatBoundedClaimChipStatusShort(c.status);

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
    empty.textContent = "No bounded receipt — select a claim chip or episode.";
    container.appendChild(empty);
    return;
  }

  const tier = receiptTrustTier(receipt);

  const wrap = document.createElement("div");
  wrap.className = "glass-bounded-claim-receipt";
  wrap.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-receipt`);
  wrap.setAttribute("data-trust-tier", tier);
  wrap.dataset.receiptSchema = receipt.schemaVersion;
  wrap.dataset.receiptId = receipt.receiptId;
  wrap.dataset.claimId = receipt.claimId;

  const header = document.createElement("header");
  header.className = "glass-bounded-claim-receipt-header";
  const meta = document.createElement("div");
  meta.className = "glass-bounded-claim-receipt-identity";
  meta.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-receipt-identity`);
  meta.textContent = `${receipt.schemaVersion} · ${receipt.receiptId}`;
  header.appendChild(meta);
  wrap.appendChild(header);

  const primary = document.createElement("div");
  primary.className = "glass-bounded-claim-receipt-primary";
  const h = document.createElement("h3");
  h.className = "glass-bounded-claim-receipt-title";
  h.textContent = receipt.title;
  const p = document.createElement("p");
  p.className = "glass-bounded-claim-receipt-statement";
  p.textContent = receipt.statement;
  primary.append(h, p);
  wrap.appendChild(primary);

  const dl = document.createElement("dl");
  dl.className = "glass-bounded-claim-receipt-meta";
  dl.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-receipt-meta`);
  const dtKind = document.createElement("dt");
  dtKind.textContent = "Kind";
  const ddKind = document.createElement("dd");
  ddKind.textContent = receipt.claimKind;
  const dtSt = document.createElement("dt");
  dtSt.textContent = "Status";
  const ddSt = document.createElement("dd");
  ddSt.textContent = receipt.statusLabel;
  dl.append(dtKind, ddKind, dtSt, ddSt);
  wrap.appendChild(dl);

  if (receipt.focusContextLine) {
    const sec = document.createElement("section");
    sec.className = "glass-bounded-claim-receipt-section";
    sec.setAttribute("data-section", "focus");
    const sh = document.createElement("span");
    sh.className = "glass-bounded-claim-receipt-section-heading";
    sh.textContent = "Focus context";
    const fc = document.createElement("p");
    fc.className = "glass-bounded-claim-receipt-focus";
    fc.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-receipt-focus`);
    fc.textContent = receipt.focusContextLine;
    sec.append(sh, fc);
    wrap.appendChild(sec);
  }

  const scopeSec = document.createElement("section");
  scopeSec.className = "glass-bounded-claim-receipt-section";
  scopeSec.setAttribute("data-section", "scope");
  const scopeH = document.createElement("span");
  scopeH.className = "glass-bounded-claim-receipt-section-heading";
  scopeH.textContent = "Scope & source";
  const scope = document.createElement("p");
  scope.className = "glass-bounded-claim-receipt-scope";
  scope.textContent = receipt.scopeNote;
  const src = document.createElement("p");
  src.className = "glass-bounded-claim-receipt-source";
  src.textContent = receipt.boundedSourceLine;
  scopeSec.append(scopeH, scope, src);
  wrap.appendChild(scopeSec);

  if (receipt.compareAnchorLine) {
    const cmpSec = document.createElement("section");
    cmpSec.className = "glass-bounded-claim-receipt-section";
    cmpSec.setAttribute("data-section", "compare");
    const ch = document.createElement("span");
    ch.className = "glass-bounded-claim-receipt-section-heading";
    ch.textContent = "Compare anchor";
    const cmp = document.createElement("p");
    cmp.className = "glass-bounded-claim-receipt-compare-anchor";
    cmp.textContent = receipt.compareAnchorLine;
    cmpSec.append(ch, cmp);
    wrap.appendChild(cmpSec);
  }

  const supSec = document.createElement("section");
  supSec.className = "glass-bounded-claim-receipt-section";
  supSec.setAttribute("data-section", "support");
  const supH = document.createElement("span");
  supH.className = "glass-bounded-claim-receipt-section-heading";
  supH.textContent = "Mechanical support";
  const ul = document.createElement("ul");
  ul.className = "glass-bounded-claim-receipt-bullets";
  ul.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-receipt-bullets`);
  for (const b of receipt.supportBullets) {
    const li = document.createElement("li");
    li.textContent = b;
    ul.appendChild(li);
  }
  supSec.append(supH, ul);
  wrap.appendChild(supSec);

  const refSec = document.createElement("section");
  refSec.className = "glass-bounded-claim-receipt-section";
  refSec.setAttribute("data-section", "refs");
  const refH = document.createElement("span");
  refH.className = "glass-bounded-claim-receipt-section-heading";
  refH.textContent = "Evidence ref keys";
  const keys = document.createElement("p");
  keys.className = "glass-bounded-claim-receipt-refs";
  keys.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-receipt-keys`);
  keys.textContent = receipt.evidenceRefKeys.join("; ") || "(none)";
  refSec.append(refH, keys);
  wrap.appendChild(refSec);

  const limSec = document.createElement("section");
  limSec.className = "glass-bounded-claim-receipt-section";
  limSec.setAttribute("data-section", "limits");
  const limH = document.createElement("span");
  limH.className = "glass-bounded-claim-receipt-section-heading";
  limH.textContent = "Does not imply";
  const not = document.createElement("p");
  not.className = "glass-bounded-claim-receipt-not";
  not.textContent = receipt.doesNotImply;
  limSec.append(limH, not);
  wrap.appendChild(limSec);

  if (receipt.weaknessOrUnavailableNote) {
    const hn = document.createElement("p");
    hn.className = "glass-bounded-claim-receipt-limitation";
    hn.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-receipt-limitation`);
    hn.textContent = receipt.weaknessOrUnavailableNote;
    wrap.appendChild(hn);
  }

  const footer = document.createElement("footer");
  footer.className = "glass-bounded-claim-receipt-footer";
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "glass-bounded-claim-receipt-copy";
  copyBtn.setAttribute("data-testid", `${options.testIdPrefix}-bounded-claim-receipt-copy`);
  copyBtn.textContent = "Copy bounded receipt (text)";
  copyBtn.addEventListener("click", () => {
    const text = [
      receipt.schemaVersion,
      receipt.receiptId,
      `claim: ${receipt.claimId} (${receipt.claimKind})`,
      receipt.title,
      receipt.statusLabel,
      receipt.statement,
      receipt.focusContextLine ? `Focus: ${receipt.focusContextLine}` : "",
      `Scope: ${receipt.scopeNote}`,
      `Source: ${receipt.boundedSourceLine}`,
      receipt.compareAnchorLine ? `Compare anchor: ${receipt.compareAnchorLine}` : "",
      `Evidence refs: ${receipt.evidenceRefKeys.join("; ")}`,
      `Does not imply: ${receipt.doesNotImply}`,
      "Support:",
      ...receipt.supportBullets.map((x) => `• ${x}`),
      receipt.weaknessOrUnavailableNote ? `Note: ${receipt.weaknessOrUnavailableNote}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    void navigator.clipboard.writeText(text).catch(() => {});
  });
  footer.appendChild(copyBtn);
  wrap.appendChild(footer);

  container.appendChild(wrap);
}

/**
 * Vertical Slice v19 — audit hardening: compare baseline change resets bounded trust selections.
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";
import {
  RECEIPT_EMPTY_SUPPLEMENT_AFTER_TEMPORAL_BASELINE,
  VERTICAL_SLICE_FLAGSHIP_V18_PACK_FILE,
} from "../app/verticalSliceV0.js";
import { loadGlassPack } from "../pack/loadPack.js";
import { mountReplayShell } from "./replayOnlyShell.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function flagshipBytes(): Uint8Array {
  return new Uint8Array(
    readFileSync(
      join(
        __dirname,
        "..",
        "..",
        "..",
        "tests",
        "fixtures",
        "canonical_scenarios_v15",
        VERTICAL_SLICE_FLAGSHIP_V18_PACK_FILE,
      ),
    ),
  );
}

describe("Vertical Slice v19 — compare baseline handoff (replay)", () => {
  it("clears episode and claim selection when compare baseline changes via temporal ring", () => {
    const root = document.createElement("div");
    const h = mountReplayShell(root);
    const r = loadGlassPack(flagshipBytes(), "strict_kinds");
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    h.dispatch({
      type: "load_ok",
      fileName: "t.glass_pack",
      manifest: r.manifest,
      events: r.events,
    });
    h.dispatch({ type: "seek_index", index: 3 });
    h.dispatch({ type: "seek_index", index: r.events.length - 1 });

    const paintChips = root.querySelectorAll('[data-testid="bounded-temporal-paint-chip"]');
    const nonCurrent = Array.from(paintChips).find(
      (el) => (el as HTMLElement).dataset.current !== "true",
    ) as HTMLButtonElement | undefined;
    if (!nonCurrent) {
      throw new Error("need a non-current paint chip to change baseline");
    }

    const claimChips = root.querySelectorAll('[data-testid="replay-bounded-claim-chip"]');
    expect(claimChips.length).toBeGreaterThan(0);
    (claimChips[0] as HTMLButtonElement).click();
    expect(root.querySelector(".glass-bounded-claim-chip--selected")).toBeTruthy();

    const firstEp = root.querySelector(
      '[data-testid="replay-bounded-episode-card"]',
    ) as HTMLButtonElement | null;
    if (firstEp) {
      firstEp.click();
      expect(root.querySelector(".glass-bounded-episode-card--selected")).toBeTruthy();
    }

    nonCurrent.click();

    expect(root.querySelector(".glass-bounded-claim-chip--selected")).toBeNull();
    expect(root.querySelector(".glass-bounded-episode-card--selected")).toBeNull();

    const emptySup = root.querySelector(
      '[data-testid="replay-bounded-claim-receipt-empty-supplement"]',
    );
    expect(emptySup).not.toBeNull();
    expect(emptySup?.textContent).toBe(RECEIPT_EMPTY_SUPPLEMENT_AFTER_TEMPORAL_BASELINE);
  });
});

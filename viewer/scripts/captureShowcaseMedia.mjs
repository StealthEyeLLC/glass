/**
 * One-shot showcase captures for docs/media/*.png (dev server must be running).
 * Run from repo root: node viewer/scripts/captureShowcaseMedia.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:5173
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const outDir = path.join(repoRoot, "docs/media");

const base =
  process.argv[2]?.replace(/\/$/, "") ?? "http://127.0.0.1:5173";

async function waitForReplayShowcaseReady(page) {
  await page.waitForSelector('[data-testid="replay-scene-v0"]', { timeout: 60_000 });
  await page.waitForSelector('[data-testid="replay-position"]', { timeout: 60_000 });
}

async function waitForReplayTrustState(page) {
  await page.waitForSelector('[data-testid="replay-bounded-claim-chip"]', { timeout: 60_000 });
  await page.waitForSelector('[data-testid="replay-bounded-evidence"]', { timeout: 60_000 });
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  const flagship = `${base}/?fixture=flagship`;
  await page.goto(flagship, { waitUntil: "load", timeout: 60_000 });
  await waitForReplayShowcaseReady(page);
  await page.locator('[data-testid="replay-jump-end"]').click();
  await waitForReplayTrustState(page);

  await page.screenshot({
    path: path.join(outDir, "01-replay-flagship-overview.png"),
    fullPage: true,
  });

  const flagshipTechnical = `${base}/?fixture=flagship&surface=technical`;
  await page.goto(flagshipTechnical, { waitUntil: "load", timeout: 60_000 });
  await waitForReplayShowcaseReady(page);
  await page.locator('[data-testid="replay-jump-end"]').click();
  await waitForReplayTrustState(page);
  await page.locator('[data-testid="replay-bounded-claim-chip"]').first().click();
  await page.waitForSelector('[data-testid="replay-bounded-claim-receipt"]', { timeout: 60_000 });
  await page.locator('[data-testid="replay-bounded-claim-receipt-ids"] summary').click();
  const receipt = page.locator('[data-testid="replay-bounded-claim-receipt-root"]');
  await receipt.scrollIntoViewIfNeeded();
  await page.waitForSelector('[data-testid="replay-bounded-claim-receipt-identity"]', { timeout: 60_000 });
  await receipt.screenshot({
    path: path.join(outDir, "02-claim-chain-receipt.png"),
  });

  await page.goto(flagship, { waitUntil: "load", timeout: 60_000 });
  await waitForReplayShowcaseReady(page);
  await page.locator('[data-testid="replay-jump-end"]').click();
  await waitForReplayTrustState(page);
  await page.locator('[data-testid="bounded-temporal-paint-chip"]:not([data-current="true"])').first().click();
  await page.waitForSelector('[data-testid="bounded-temporal-reset-baseline"]', { timeout: 60_000 });
  const temporal = page.locator('[data-testid="replay-temporal-lens-root"]');
  await temporal.scrollIntoViewIfNeeded();
  await temporal.screenshot({
    path: path.join(outDir, "03-temporal-lens-compare.png"),
  });

  const live = `${base}/?live=1`;
  await page.goto(live, { waitUntil: "load", timeout: 60_000 });
  await page.waitForSelector('[data-testid="live-vs-hero"]', { timeout: 60_000 });
  await page.waitForSelector('[data-testid="live-trust-setup"]', { timeout: 60_000 });
  await page.screenshot({
    path: path.join(outDir, "04-live-shell-overview.png"),
    fullPage: true,
  });

  await browser.close();
  console.log("Wrote PNGs under", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

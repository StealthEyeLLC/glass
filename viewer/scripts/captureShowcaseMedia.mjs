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
  await page.waitForSelector('[data-testid="replay-scene-v0"]', { timeout: 60_000 });

  await page.screenshot({
    path: path.join(outDir, "01-replay-flagship-overview.png"),
    fullPage: true,
  });

  const receipt = page.locator('[data-testid="replay-bounded-claim-receipt-root"]');
  await receipt.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await receipt.screenshot({
    path: path.join(outDir, "02-claim-chain-receipt.png"),
  });

  const temporal = page.locator('[data-testid="replay-temporal-lens-root"]');
  await temporal.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await temporal.screenshot({
    path: path.join(outDir, "03-temporal-lens-compare.png"),
  });

  const live = `${base}/?live=1`;
  await page.goto(live, { waitUntil: "load", timeout: 60_000 });
  await page.waitForSelector('[data-testid="live-vs-hero"]', { timeout: 60_000 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, "04-live-shell-overview.png"),
    fullPage: false,
  });

  await browser.close();
  console.log("Wrote PNGs under", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

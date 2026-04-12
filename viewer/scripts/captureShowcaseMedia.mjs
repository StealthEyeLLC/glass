/**
 * One-shot showcase captures for docs/media/*.png (dev server must be running).
 * Run from repo root: node viewer/scripts/captureShowcaseMedia.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:5173
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");
const outDir = path.join(repoRoot, "docs/media");
const artHelper = path.join(__dirname, "buildShowcaseMediaArt.py");

const base =
  process.argv[2]?.replace(/\/$/, "") ?? "http://127.0.0.1:5173";

const motionPath = path.join(outDir, "00-flagship-replay-motion.gif");
const overviewPath = path.join(outDir, "01-replay-flagship-overview.png");
const socialPreviewPath = path.join(outDir, "social-preview.png");

async function waitForReplayShowcaseReady(page) {
  await page.waitForSelector('[data-testid="replay-scene-v0"]', { timeout: 60_000 });
  await page.waitForSelector('[data-testid="replay-position"]', { timeout: 60_000 });
}

async function waitForReplayTrustState(page) {
  await page.waitForSelector('[data-testid="replay-bounded-claim-chip"]', { timeout: 60_000 });
  await page.waitForSelector('[data-testid="replay-bounded-evidence"]', { timeout: 60_000 });
}

async function waitForReplayStep(page, ordinal) {
  await page.waitForFunction(
    (expectedOrdinal) =>
      (document.querySelector('[data-testid="replay-position"]')?.textContent ?? "").includes(
        `Step ${expectedOrdinal} of`,
      ),
    ordinal,
    { timeout: 60_000 },
  );
}

async function captureFlagshipMotionFrames(page, framesDir) {
  const flagship = `${base}/?fixture=flagship`;
  await page.goto(flagship, { waitUntil: "load", timeout: 60_000 });
  await waitForReplayShowcaseReady(page);
  await page.locator('[data-testid="replay-jump-start"]').click();
  await waitForReplayStep(page, 1);
  await page.evaluate(() => window.scrollTo(0, 180));
  // Favor a few legible state changes over rapid motion.
  const ordinals = [1, 3, 5, 8, 11, 14];
  let currentOrdinal = 1;
  for (let i = 0; i < ordinals.length; i += 1) {
    const targetOrdinal = ordinals[i];
    while (currentOrdinal < targetOrdinal) {
      await page.locator('[data-testid="replay-step-next"]').click();
      currentOrdinal += 1;
      await waitForReplayStep(page, currentOrdinal);
    }
    await page.screenshot({
      path: path.join(framesDir, `motion-${String(i).padStart(2, "0")}.png`),
      fullPage: false,
    });
  }
}

function buildShowcaseArt(framesDir) {
  const args = ["-B", artHelper, framesDir, overviewPath, motionPath, socialPreviewPath];
  const candidates = process.platform === "win32" ? ["python", "py"] : ["python3", "python"];
  let lastError = null;
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, args, { stdio: "inherit" });
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(
    `Showcase art generation requires Python with Pillow installed. Last error: ${String(lastError)}`,
  );
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const framesDir = fs.mkdtempSync(path.join(os.tmpdir(), "glass-showcase-"));

  const browser = await chromium.launch({ headless: true });
  try {
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
      path: overviewPath,
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

    const motionPage = await context.newPage();
    await captureFlagshipMotionFrames(motionPage, framesDir);
  } finally {
    await browser.close();
  }

  try {
    buildShowcaseArt(framesDir);
  } finally {
    fs.rmSync(framesDir, { recursive: true, force: true });
  }
  console.log("Wrote PNGs under", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

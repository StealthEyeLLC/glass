/**
 * Verifies the Vertical Slice v0 fixture with `glass-pack validate` (Rust) from repo root.
 * Usage: node scripts/verifyVerticalSliceFixture.mjs (run from viewer/)
 */
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const pack = join(
  repoRoot,
  "tests",
  "fixtures",
  "vertical_slice_v0",
  "glass_vertical_slice_v0_tier_b.glass_pack",
);

if (!existsSync(pack)) {
  console.error(`Missing fixture: ${pack}\nRun: npm run fixture:vertical-slice`);
  process.exit(1);
}

const r = spawnSync(
  "cargo",
  [
    "run",
    "-p",
    "glass-pack",
    "--",
    "validate",
    pack,
    "--strict-kinds",
  ],
  { cwd: repoRoot, stdio: "inherit", shell: false },
);

process.exit(r.status ?? 1);

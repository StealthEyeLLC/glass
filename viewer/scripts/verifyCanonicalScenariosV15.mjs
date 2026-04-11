/**
 * Verifies all Vertical Slice v15 canonical scenario packs with `glass-pack validate --strict-kinds`.
 * Usage: node scripts/verifyCanonicalScenariosV15.mjs (from viewer/)
 */
import { spawnSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const dir = join(repoRoot, "tests", "fixtures", "canonical_scenarios_v15");

if (!existsSync(dir)) {
  console.error(`Missing directory: ${dir}\nRun: npm run fixture:canonical-scenarios-v15`);
  process.exit(1);
}

const packs = readdirSync(dir).filter((f) => f.endsWith(".glass_pack")).sort();
if (packs.length === 0) {
  console.error(`No .glass_pack files in ${dir}`);
  process.exit(1);
}

let code = 0;
for (const f of packs) {
  const pack = join(dir, f);
  process.stdout.write(`validate ${f}\n`);
  const r = spawnSync(
    "cargo",
    ["run", "-p", "glass-pack", "--", "validate", pack, "--strict-kinds"],
    { cwd: repoRoot, stdio: "inherit", shell: false },
  );
  const c = r.status ?? 1;
  if (c !== 0) {
    code = c;
    break;
  }
}

process.exit(code);

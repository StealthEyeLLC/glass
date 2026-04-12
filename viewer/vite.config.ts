import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const flagshipFixtureSourceFile = path.join(
  repoRoot,
  "tests/fixtures/canonical_scenarios_v15/canonical_v15_append_heavy.glass_pack",
);
const flagshipFixtureDistFile = "fixtures/canonical_v15_append_heavy.glass_pack";

/**
 * Serves committed replay fixtures in dev and emits the flagship pack into production `dist/`.
 */
function glassFixturePlugin(): Plugin {
  return {
    name: "glass-fixture",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split("?")[0];
        if (
          pathname ===
          "/__glass__/dev/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack"
        ) {
          const file = path.join(
            repoRoot,
            "tests/fixtures/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack",
          );
          if (!fs.existsSync(file)) {
            res.statusCode = 404;
            res.end("glass dev fixture missing on disk");
            return;
          }
          res.setHeader("Content-Type", "application/zip");
          fs.createReadStream(file).on("error", () => {
            res.statusCode = 500;
            res.end();
          }).pipe(res);
          return;
        }
        if (
          pathname ===
          "/__glass__/dev/canonical_scenarios_v15/canonical_v15_append_heavy.glass_pack"
        ) {
          if (!fs.existsSync(flagshipFixtureSourceFile)) {
            res.statusCode = 404;
            res.end("glass dev fixture missing on disk");
            return;
          }
          res.setHeader("Content-Type", "application/zip");
          fs.createReadStream(flagshipFixtureSourceFile).on("error", () => {
            res.statusCode = 500;
            res.end();
          }).pipe(res);
          return;
        }
        next();
      });
    },
    generateBundle() {
      if (!fs.existsSync(flagshipFixtureSourceFile)) {
        throw new Error("flagship fixture missing on disk for production build");
      }
      this.emitFile({
        type: "asset",
        fileName: flagshipFixtureDistFile,
        source: fs.readFileSync(flagshipFixtureSourceFile),
      });
    },
  };
}

export default defineConfig({
  base: process.env.GLASS_PUBLIC_BASE ?? "/",
  plugins: [glassFixturePlugin()],
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

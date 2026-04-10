import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

/**
 * Serves the committed Vertical Slice v0 `.glass_pack` only when `vite` dev server runs.
 * No `configureServer` in `vite build` / `vite preview` — production `dist/` has no route.
 */
function glassDevFixturePlugin(): Plugin {
  return {
    name: "glass-dev-fixture",
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
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [glassDevFixturePlugin()],
  root: ".",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});

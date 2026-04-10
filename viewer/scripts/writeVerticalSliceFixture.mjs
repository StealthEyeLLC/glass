/**
 * Writes the committed Vertical Slice v0 Tier B `.glass_pack` fixture (JSONL scaffold).
 * Synthetic minimal events for deterministic tests — not live collector telemetry.
 *
 * Usage: node scripts/writeVerticalSliceFixture.mjs
 * From repo root after changing this script, re-run and commit the updated bytes.
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { strToU8, zipSync } from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CANONICAL_EVENT_SCHEMA_VERSION = "glass.event.v0";
const PACK_FORMAT_SCAFFOLD_V0 = "glass.pack.v0.scaffold";

/** Must match docs and tests — single known-good Vertical Slice v0 fixture session id. */
const VERTICAL_SLICE_V0_FIXTURE_SESSION_ID = "glass_vertical_slice_v0";

const repoRoot = join(__dirname, "..", "..");
const outDir = join(repoRoot, "tests", "fixtures", "vertical_slice_v0");
const outFile = join(outDir, "glass_vertical_slice_v0_tier_b.glass_pack");

function event(seq) {
  return {
    schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
    event_id: `vs0_evt_${seq}`,
    session_id: VERTICAL_SLICE_V0_FIXTURE_SESSION_ID,
    ts_ns: seq * 1000,
    seq,
    kind: "process_poll_sample",
    actor: {
      entity_type: "process",
      entity_id: `fixture_entity_${seq}`,
    },
    attrs: {
      note: "synthetic_vertical_slice_v0_fixture",
      not_kernel_lifecycle_event: true,
    },
    source: {
      adapter: "fixture",
      quality: "direct",
      time_domain: "session_monotonic",
    },
  };
}

const manifest = {
  pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
  session_id: VERTICAL_SLICE_V0_FIXTURE_SESSION_ID,
  capture_mode: "replay",
  sanitized: false,
  human_readable_redaction_summary: [],
  share_safe_recommended: false,
};

const lines = [1, 2, 3].map((n) => JSON.stringify(event(n))).join("\n") + "\n";

const zipBytes = zipSync({
  "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
  "events.jsonl": strToU8(lines),
});

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, zipBytes);
process.stdout.write(`Wrote ${outFile} (${zipBytes.length} bytes)\n`);

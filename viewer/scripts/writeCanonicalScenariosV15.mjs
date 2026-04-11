/**
 * Writes Vertical Slice v15 canonical scenario `.glass_pack` fixtures (JSONL scaffold).
 * Synthetic events — not live collector telemetry.
 *
 * Usage: node scripts/writeCanonicalScenariosV15.mjs
 */
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { strToU8, zipSync } from "fflate";

const __dirname = dirname(fileURLToPath(import.meta.url));

const CANONICAL_EVENT_SCHEMA_VERSION = "glass.event.v0";
const PACK_FORMAT_SCAFFOLD_V0 = "glass.pack.v0.scaffold";

const repoRoot = join(__dirname, "..", "..");
const outDir = join(repoRoot, "tests", "fixtures", "canonical_scenarios_v15");

function processPollEvent(sessionId, seq, note) {
  return {
    schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
    event_id: `canonical_v15_proc_${sessionId}_${seq}`,
    session_id: sessionId,
    ts_ns: seq * 1000,
    seq,
    kind: "process_poll_sample",
    actor: {
      entity_type: "process",
      entity_id: `fixture_proc_${sessionId}_${seq}`,
    },
    attrs: {
      note,
      not_kernel_lifecycle_event: true,
    },
    source: {
      adapter: "fixture",
      quality: "direct",
      time_domain: "session_monotonic",
    },
  };
}

function filePollEvent(sessionId, seq, note) {
  return {
    schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
    event_id: `canonical_v15_fs_${sessionId}_${seq}`,
    session_id: sessionId,
    ts_ns: seq * 1000,
    seq,
    kind: "file_poll_snapshot",
    actor: {
      entity_type: "file",
      entity_id: `fs_poll_rel:canonical_v15/path_${seq}.txt`,
      resolution_quality: "declared_root_relative_path_directory_poll_not_kernel_inode_identity",
    },
    attrs: {
      semantics: "bounded_directory_poll_snapshot",
      not_syscall_file_access: true,
      relative_path: `canonical_v15/path_${seq}.txt`,
      watch_root: "/synthetic/canonical_v15_file_heavy",
      size_bytes: seq,
      modified_unix_secs: seq,
      poll_monotonic_ns: seq,
      first_poll_baseline: seq === 1,
      inference_level: "poll_snapshot",
      note,
    },
    source: {
      adapter: "fixture",
      quality: "direct",
      time_domain: "session_monotonic",
    },
  };
}

function writePack(fileName, sessionId, eventLines) {
  const manifest = {
    pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
    session_id: sessionId,
    capture_mode: "replay",
    sanitized: false,
    human_readable_redaction_summary: [],
    share_safe_recommended: false,
  };
  const lines = eventLines.map((e) => JSON.stringify(e)).join("\n") + "\n";
  const zipBytes = zipSync({
    "manifest.json": strToU8(JSON.stringify(manifest, null, 2)),
    "events.jsonl": strToU8(lines),
  });
  const outFile = join(outDir, fileName);
  writeFileSync(outFile, zipBytes);
  process.stdout.write(`Wrote ${outFile} (${zipBytes.length} bytes)\n`);
}

mkdirSync(outDir, { recursive: true });

const REPLACE_SESSION = "canonical_v15_replace_heavy";
writePack(
  "canonical_v15_replace_heavy.glass_pack",
  REPLACE_SESSION,
  Array.from({ length: 8 }, (_, i) =>
    processPollEvent(REPLACE_SESSION, i + 1, "synthetic_canonical_v15_replace_heavy_fixture"),
  ),
);

const APPEND_SESSION = "canonical_v15_append_heavy";
writePack(
  "canonical_v15_append_heavy.glass_pack",
  APPEND_SESSION,
  Array.from({ length: 14 }, (_, i) =>
    processPollEvent(APPEND_SESSION, i + 1, "synthetic_canonical_v15_append_heavy_fixture"),
  ),
);

const CALM_SESSION = "canonical_v15_calm_steady";
writePack(
  "canonical_v15_calm_steady.glass_pack",
  CALM_SESSION,
  Array.from({ length: 6 }, (_, i) =>
    processPollEvent(CALM_SESSION, i + 1, "synthetic_canonical_v15_calm_steady_fixture"),
  ),
);

const FILE_SESSION = "canonical_v15_file_heavy";
writePack(
  "canonical_v15_file_heavy.glass_pack",
  FILE_SESSION,
  Array.from({ length: 7 }, (_, i) =>
    filePollEvent(FILE_SESSION, i + 1, "synthetic_canonical_v15_file_heavy_fixture"),
  ),
);

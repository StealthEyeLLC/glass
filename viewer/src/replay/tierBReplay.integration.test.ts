/**
 * Pack bytes + replay model (Node env for fflate zipSync).
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { encodeEventsSegV1 } from "../pack/eventsSeg.js";
import { loadGlassPack } from "../pack/loadPack.js";
import {
  CANONICAL_EVENT_SCHEMA_VERSION,
  type GlassEvent,
  PACK_FORMAT_SCAFFOLD_SEG_V0,
  PACK_FORMAT_SCAFFOLD_V0,
} from "../pack/types.js";
import {
  currentEvent,
  initialReplayState,
  reduceReplay,
} from "./replayModel.js";

function zipPack(
  manifest: Record<string, unknown>,
  jsonl: string,
): Uint8Array {
  return zipSync({
    "manifest.json": strToU8(JSON.stringify(manifest)),
    "events.jsonl": strToU8(jsonl),
  });
}

function zipSegPack(
  manifest: Record<string, unknown>,
  segBytes: Uint8Array,
): Uint8Array {
  return zipSync({
    "manifest.json": strToU8(JSON.stringify(manifest)),
    "events.seg": segBytes,
  });
}

describe("Tier B replay integration (zip → load → state)", () => {
  it("sanitized pack flows into replay-ready state with summary", () => {
    const sessionId = "ses_int";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: true,
      human_readable_redaction_summary: ["rule:home_path", "rule:tilde_path"],
      share_safe_recommended: false,
      events_blob: "events.jsonl",
    };
    const row = {
      schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
      event_id: "e1",
      session_id: sessionId,
      ts_ns: 10,
      seq: 1,
      kind: "process_start",
      actor: { entity_type: "process", entity_id: "proc_a" },
      attrs: {},
      source: { adapter: "t", quality: "direct", time_domain: "session_monotonic" },
    };
    const z = zipPack(manifest, `${JSON.stringify(row)}\n`);
    const r = loadGlassPack(z, "strict_kinds");
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    const s0 = initialReplayState();
    const s = reduceReplay(s0, {
      type: "load_ok",
      fileName: "demo.glass_pack",
      manifest: r.manifest,
      events: r.events,
    });
    expect(s.manifest?.sanitized).toBe(true);
    expect(s.manifest?.human_readable_redaction_summary).toContain("rule:home_path");
    expect(currentEvent(s)?.kind).toBe("process_start");
  });

  it("sanitized process_poll_sample pack passes strict_kinds and replay", () => {
    const sessionId = "ses_procfs_share";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
      session_id: sessionId,
      capture_mode: "procfs_poll_dev",
      fidelity_tier: "fallback_reduced",
      active_adapter_id: "procfs_process",
      sanitized: true,
      share_safe_recommended: false,
      human_readable_redaction_summary: [
        "rule:procfs_exe_field -> [REDACTED_ABS_PATH]",
      ],
      export_sanitization_profile: "sanitize_default",
      sanitization_profile_version: "sanitize_default.1.provisional",
      events_blob: "events.jsonl",
    };
    const row = {
      schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
      event_id: "evt_procfs_1",
      session_id: sessionId,
      ts_ns: 1,
      seq: 1,
      kind: "process_poll_sample",
      actor: {
        entity_type: "process",
        entity_id: "procfs_pid:1",
        resolution_quality: "linux_pid_ephemeral_procfs_poll",
      },
      attrs: {
        exe: "[REDACTED_ABS_PATH]",
        comm: "app",
        pid: 1,
        semantics: "procfs_poll_snapshot",
        not_kernel_lifecycle_event: true,
      },
      source: {
        adapter: "procfs_process",
        quality: "procfs_derived",
        time_domain: "collector_monotonic_ns",
        inference_level: "poll_snapshot",
        kernel_spawn_exit_atomic_truth: false,
      },
    };
    const z = zipPack(manifest, `${JSON.stringify(row)}\n`);
    const r = loadGlassPack(z, "strict_kinds");
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    const s = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "procfs_share.glass_pack",
      manifest: r.manifest,
      events: r.events,
    });
    expect(s.manifest?.sanitized).toBe(true);
    expect(currentEvent(s)?.kind).toBe("process_poll_sample");
    expect(
      (currentEvent(s)?.attrs as Record<string, unknown>)?.exe,
    ).toBe("[REDACTED_ABS_PATH]");
  });

  it("scaffold_seg pack builds same replay state as JSONL (sanitized summary)", () => {
    const sessionId = "ses_seg_int";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_SEG_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: true,
      human_readable_redaction_summary: ["rule:home_path"],
      share_safe_recommended: false,
      events_blob: "events.seg",
    };
    const row = {
      schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
      event_id: "e1",
      session_id: sessionId,
      ts_ns: 10,
      seq: 1,
      kind: "process_start",
      actor: { entity_type: "process", entity_id: "proc_a" },
      attrs: {},
      source: {
        adapter: "t",
        quality: "direct",
        time_domain: "session_monotonic",
      },
    };
    const z = zipSegPack(manifest, encodeEventsSegV1([row as GlassEvent]));
    const r = loadGlassPack(z, "strict_kinds");
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    const s = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "seg.glass_pack",
      manifest: r.manifest,
      events: r.events,
    });
    expect(s.manifest?.sanitized).toBe(true);
    expect(currentEvent(s)?.kind).toBe("process_start");
  });

  it("scaffold_seg sanitized process_poll_sample passes strict_kinds + replay", () => {
    const sessionId = "ses_seg_procfs";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_SEG_V0,
      session_id: sessionId,
      capture_mode: "procfs_poll_dev",
      fidelity_tier: "fallback_reduced",
      active_adapter_id: "procfs_process",
      sanitized: true,
      share_safe_recommended: false,
      human_readable_redaction_summary: [
        "rule:procfs_exe_field -> [REDACTED_ABS_PATH]",
      ],
      export_sanitization_profile: "sanitize_default",
      sanitization_profile_version: "sanitize_default.1.provisional",
      events_blob: "events.seg",
    };
    const row = {
      schema_version: CANONICAL_EVENT_SCHEMA_VERSION,
      event_id: "evt_seg_procfs_1",
      session_id: sessionId,
      ts_ns: 1,
      seq: 1,
      kind: "process_poll_sample",
      actor: {
        entity_type: "process",
        entity_id: "procfs_pid:1",
        resolution_quality: "linux_pid_ephemeral_procfs_poll",
      },
      attrs: {
        exe: "[REDACTED_ABS_PATH]",
        comm: "app",
        pid: 1,
        semantics: "procfs_poll_snapshot",
        not_kernel_lifecycle_event: true,
      },
      source: {
        adapter: "procfs_process",
        quality: "procfs_derived",
        time_domain: "collector_monotonic_ns",
        inference_level: "poll_snapshot",
        kernel_spawn_exit_atomic_truth: false,
      },
    };
    const z = zipSegPack(manifest, encodeEventsSegV1([row as GlassEvent]));
    const r = loadGlassPack(z, "strict_kinds");
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    const s = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "seg_procfs.glass_pack",
      manifest: r.manifest,
      events: r.events,
    });
    expect(currentEvent(s)?.kind).toBe("process_poll_sample");
  });

  it("empty events.jsonl yields ready state with zero events", () => {
    const sessionId = "ses_empty";
    const manifest = {
      pack_format_version: PACK_FORMAT_SCAFFOLD_V0,
      session_id: sessionId,
      capture_mode: "replay",
      sanitized: false,
      human_readable_redaction_summary: [],
      share_safe_recommended: false,
    };
    const z = zipPack(manifest, "\n\n");
    const r = loadGlassPack(z, "basic");
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    const s = reduceReplay(initialReplayState(), {
      type: "load_ok",
      fileName: "empty.glass_pack",
      manifest: r.manifest,
      events: r.events,
    });
    expect(s.events.length).toBe(0);
    expect(currentEvent(s)).toBeUndefined();
  });
});

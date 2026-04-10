/**
 * Fixture-backed goldens for semantic-tag summaries (Node I/O).
 * @vitest-environment node
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createInitialLiveSessionModelState } from "../live/applyLiveSessionMessage.js";
import { compileLiveToGlassSceneV0 } from "./compileLiveScene.js";
import {
  exportTagSummaryToJsonLines,
  listSemanticTagsForScene,
} from "./semanticTagSummaryV0.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("exportTagSummaryToJsonLines", () => {
  it("emits stable JSONL with index and tag", () => {
    expect(exportTagSummaryToJsonLines(["a", "b"])).toBe(
      '{"i":0,"tag":"a"}\n{"i":1,"tag":"b"}\n',
    );
  });

  it("returns empty string for empty input", () => {
    expect(exportTagSummaryToJsonLines([])).toBe("");
  });
});

describe("semantic tag summary goldens", () => {
  it("live idle scene matches fixture (primitive-level tags)", () => {
    const scene = compileLiveToGlassSceneV0({
      model: createInitialLiveSessionModelState("golden-fixture-sid"),
      lastReconcile: null,
    });
    const tags = listSemanticTagsForScene(scene);
    const exported = exportTagSummaryToJsonLines([...tags]);
    const fixture = readFileSync(
      join(__dirname, "__fixtures__/semantic_tag_summary_live_idle_v0.jsonl"),
      "utf8",
    );
    expect(exported).toBe(fixture);
  });
});

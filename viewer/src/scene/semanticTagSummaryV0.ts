/**
 * Deterministic semantic-tag summaries for Scene v0 / Drawable Primitives v0 — inspection and tests only.
 * Does not add visual truth beyond existing primitive `semanticTag` values; not a competing semantic layer.
 */

import type { GlassSceneV0, SceneBounds } from "./glassSceneV0.js";
import {
  edgeFrameTagsForStroke,
  type DrawablePrimitive,
  type DrawablePrimitiveSemanticTag,
} from "./drawablePrimitivesV0.js";
import { sceneToDrawablePrimitives } from "./sceneToDrawablePrimitives.js";

/** Ordered tags for the primitive list (one entry per primitive, same order as input). */
export function listSemanticTagsForPrimitives(
  primitives: readonly DrawablePrimitive[],
): readonly DrawablePrimitiveSemanticTag[] {
  return primitives.map((p) => p.semanticTag);
}

/** Alias for tooling/tests that prefer a "summary" name — identical to `listSemanticTagsForPrimitives`. */
export function primitiveTagsSummary(
  primitives: readonly DrawablePrimitive[],
): readonly DrawablePrimitiveSemanticTag[] {
  return listSemanticTagsForPrimitives(primitives);
}

/** Tags for a compiled scene’s drawable list (optional layout overrides `scene.bounds` sizing). */
export function listSemanticTagsForScene(
  scene: GlassSceneV0,
  layout?: Pick<SceneBounds, "widthCss" | "heightCss">,
): readonly DrawablePrimitiveSemanticTag[] {
  return listSemanticTagsForPrimitives(sceneToDrawablePrimitives(scene, layout));
}

/**
 * Tags as the WebGPU geometry path expands strokes: each `stroke_rect` becomes four edge tags
 * (top → bottom → left → right), matching `expandStrokeRectToFillRects` / `edgeFrameTagsForStroke`.
 */
export function listSemanticTagsForWebGpuPrimitiveExpansion(
  primitives: readonly DrawablePrimitive[],
): readonly DrawablePrimitiveSemanticTag[] {
  const out: DrawablePrimitiveSemanticTag[] = [];
  for (const p of primitives) {
    if (p.kind === "fill_rect") {
      out.push(p.semanticTag);
    } else {
      out.push(...edgeFrameTagsForStroke(p.semanticTag));
    }
  }
  return out;
}

export function listSemanticTagsForSceneWebGpuExpansion(
  scene: GlassSceneV0,
  layout?: Pick<SceneBounds, "widthCss" | "heightCss">,
): readonly DrawablePrimitiveSemanticTag[] {
  return listSemanticTagsForWebGpuPrimitiveExpansion(sceneToDrawablePrimitives(scene, layout));
}

/**
 * Stable JSONL: one `{"i":<index>,"tag":<string>}` per line, UTF-8, trailing newline when non-empty.
 * For golden fixtures and tooling only — does not add semantic claims beyond the input tag strings.
 */
export function exportTagSummaryToJsonLines(tags: readonly string[]): string {
  if (tags.length === 0) {
    return "";
  }
  return tags.map((tag, i) => JSON.stringify({ i, tag })).join("\n") + "\n";
}

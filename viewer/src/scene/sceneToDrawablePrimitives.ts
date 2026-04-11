/**
 * Scene System v0 → Drawable Primitives v0 (renderer bridge).
 */

import {
  applyBoundedCompareOverlaysToPrimitives,
  computeBoundedSceneCompare,
} from "./boundedSceneCompare.js";
import { applyBoundedSceneFocusToPrimitives, computeBoundedSceneFocus } from "./boundedSceneFocus.js";
import { computeBoundedStripLayoutFromFocus } from "./boundedSceneFocusReflow.js";
import type { GlassSceneV0, SceneBounds } from "./glassSceneV0.js";
import {
  appendBoundedActorClusterStrip,
  applyBoundedEmphasisOverlays,
  applyBoundedSceneComposition,
  buildBoundedVisualGeometryPrimitives,
  type DrawablePrimitive,
} from "./drawablePrimitivesV0.js";
import { liveVisualSpecFromScene } from "./sceneToLiveVisualSpec.js";

/**
 * Pure compile: bounded scene → drawable primitives for the strip layout.
 * When `layout` is provided, its CSS size is used for placement (may differ from `scene.bounds` during tests);
 * otherwise `scene.bounds` defines width/height.
 */
export function sceneToDrawablePrimitives(
  scene: GlassSceneV0,
  layout?: Pick<SceneBounds, "widthCss" | "heightCss">,
  options?: { focusedSelectionId?: string | null; previousScene?: GlassSceneV0 | null },
): DrawablePrimitive[] {
  const w = layout?.widthCss ?? scene.bounds.widthCss;
  const h = layout?.heightCss ?? scene.bounds.heightCss;
  const focus = computeBoundedSceneFocus(scene, options?.focusedSelectionId ?? null);
  const strip = computeBoundedStripLayoutFromFocus(scene, focus, options?.focusedSelectionId ?? null);
  const prev = options?.previousScene ?? null;
  const cmp = computeBoundedSceneCompare(prev, scene, {
    selectedId: options?.focusedSelectionId ?? null,
  });
  const spec = liveVisualSpecFromScene(scene, options?.focusedSelectionId ?? null, {
    previousScene: prev,
    compare: cmp,
  });
  const out = buildBoundedVisualGeometryPrimitives(spec, w, h, strip);
  appendBoundedActorClusterStrip(scene.clusters, w, out, strip);
  applyBoundedSceneComposition(scene, w, h, out, strip);
  applyBoundedEmphasisOverlays(scene, w, h, out, strip);
  applyBoundedSceneFocusToPrimitives(scene, focus, w, h, out, strip);
  applyBoundedCompareOverlaysToPrimitives(cmp, scene, spec, w, strip, out);
  return out;
}

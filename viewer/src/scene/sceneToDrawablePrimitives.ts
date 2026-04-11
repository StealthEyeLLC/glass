/**
 * Scene System v0 → Drawable Primitives v0 (renderer bridge).
 */

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
): DrawablePrimitive[] {
  const w = layout?.widthCss ?? scene.bounds.widthCss;
  const h = layout?.heightCss ?? scene.bounds.heightCss;
  const spec = liveVisualSpecFromScene(scene);
  const out = buildBoundedVisualGeometryPrimitives(spec, w, h);
  appendBoundedActorClusterStrip(scene.clusters, w, out);
  applyBoundedSceneComposition(scene, w, h, out);
  applyBoundedEmphasisOverlays(scene, w, h, out);
  return out;
}

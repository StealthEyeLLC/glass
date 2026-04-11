/**
 * Vertical Slice v5–v7 — bounded scene selection ids + hit targets + inspector copy (+ focus + reflow).
 * Pure, DOM-free, renderer-agnostic (uses the same DrawablePrimitive stream as Canvas/WebGPU).
 */

import type { LiveVisualSpec } from "../live/liveVisualModel.js";
import { computeBoundedSceneFocus } from "./boundedSceneFocus.js";
import {
  LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT,
  LIVE_VISUAL_STATE_RAIL_LAYOUT,
} from "./drawablePrimitivesV0.js";
import type { DrawablePrimitive, DrawablePrimitiveSemanticTag } from "./drawablePrimitivesV0.js";
import type { GlassSceneV0, SceneBounds, SceneBoundedRegionRole } from "./glassSceneV0.js";
import { liveVisualSpecFromScene } from "./sceneToLiveVisualSpec.js";
import { sceneToDrawablePrimitives } from "./sceneToDrawablePrimitives.js";

export const BOUNDED_SELECTION_ID_PREFIX = "glass.sel.v0" as const;

export interface BoundedSelectionHitTarget {
  /** Stable selection id; union bounds when multiple primitives share one id. */
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function regionIdForRole(
  scene: GlassSceneV0,
  role: SceneBoundedRegionRole,
): string | null {
  const r = scene.regions.find((x) => x.role === role);
  return r?.id ?? null;
}

function makeId(...parts: string[]): string {
  return `${BOUNDED_SELECTION_ID_PREFIX}:${parts.join(":")}`;
}

/** Public helper — deterministic ids for tests and shell persistence. */
export function boundedSelectionIdCluster(clusterId: string): string {
  return makeId("cluster", clusterId);
}

export function boundedSelectionIdRegion(regionId: string): string {
  return makeId("region", regionId);
}

export function boundedSelectionIdNode(nodeId: string): string {
  return makeId("node", nodeId);
}

function mapEmphasisOverlay(tag: DrawablePrimitiveSemanticTag, scene: GlassSceneV0): string | null {
  const primary = regionIdForRole(scene, "primary_wire_sample");
  const system = regionIdForRole(scene, "system_integrity");
  if (
    tag === "emphasis_wire_pulse_overlay" ||
    tag === "emphasis_sample_pulse_overlay" ||
    tag === "emphasis_replay_cursor_pulse_overlay"
  ) {
    return primary ? boundedSelectionIdRegion(primary) : null;
  }
  if (tag === "emphasis_state_rail_attention_overlay") {
    return system ? boundedSelectionIdRegion(system) : null;
  }
  if (tag === "emphasis_resync_flash_overlay" || tag === "emphasis_system_flash_overlay") {
    return system ? boundedSelectionIdRegion(system) : null;
  }
  return null;
}

function mapCompositionTag(tag: DrawablePrimitiveSemanticTag, scene: GlassSceneV0): string | null {
  if (tag === "composition_panel_primary" || tag === "composition_accent_primary") {
    const id = regionIdForRole(scene, "primary_wire_sample");
    return id ? boundedSelectionIdRegion(id) : null;
  }
  if (
    tag === "composition_panel_system" ||
    tag === "composition_accent_system" ||
    tag === "composition_separator_system_evidence"
  ) {
    const id = regionIdForRole(scene, "system_integrity");
    return id ? boundedSelectionIdRegion(id) : null;
  }
  if (tag === "composition_panel_evidence" || tag === "composition_accent_evidence") {
    const id = regionIdForRole(scene, "bounded_sample_evidence");
    return id ? boundedSelectionIdRegion(id) : null;
  }
  if (tag.startsWith("composition_bounded_scene_frame")) {
    return makeId("bounded_scene_frame");
  }
  return null;
}

function mapPrimitiveTagToSelectionId(
  p: DrawablePrimitive,
  scene: GlassSceneV0,
  clusterLaneIndex: number,
): { id: string | null; nextClusterLaneIndex: number } {
  const tag = p.semanticTag;
  if (tag.startsWith("emphasis_")) {
    return { id: mapEmphasisOverlay(tag, scene), nextClusterLaneIndex: clusterLaneIndex };
  }
  const comp = mapCompositionTag(tag, scene);
  if (comp) {
    return { id: comp, nextClusterLaneIndex: clusterLaneIndex };
  }

  switch (tag) {
    case "band_background":
      return { id: null, nextClusterLaneIndex: clusterLaneIndex };
    case "density_band":
      return { id: makeId("wire", "density_band"), nextClusterLaneIndex: clusterLaneIndex };
    case "tick_slot_replace":
      return { id: makeId("tick", "replace"), nextClusterLaneIndex: clusterLaneIndex };
    case "tick_slot_append":
      return { id: makeId("tick", "append"), nextClusterLaneIndex: clusterLaneIndex };
    case "tick_slot_resync":
      return { id: makeId("tick", "resync_wire"), nextClusterLaneIndex: clusterLaneIndex };
    case "http_chip_fill":
    case "http_chip_frame":
    case "http_chip_frame_top":
    case "http_chip_frame_bottom":
    case "http_chip_frame_left":
    case "http_chip_frame_right":
      return { id: makeId("http", "reconcile_chip"), nextClusterLaneIndex: clusterLaneIndex };
    case "band_frame":
    case "band_frame_top":
    case "band_frame_bottom":
    case "band_frame_left":
    case "band_frame_right":
      return { id: makeId("wire", "band_frame"), nextClusterLaneIndex: clusterLaneIndex };
    case "state_rail_bg":
      return { id: makeId("state_rail", "container"), nextClusterLaneIndex: clusterLaneIndex };
    case "state_rail_snapshot_lane":
      return { id: makeId("state_rail", "lane", "snapshot"), nextClusterLaneIndex: clusterLaneIndex };
    case "state_rail_resync_lane":
      return { id: makeId("state_rail", "lane", "resync"), nextClusterLaneIndex: clusterLaneIndex };
    case "state_rail_warning_lane":
      return { id: makeId("state_rail", "lane", "warning"), nextClusterLaneIndex: clusterLaneIndex };
    case "replay_prefix_lane":
      return { id: makeId("state_rail", "lane", "replay_prefix"), nextClusterLaneIndex: clusterLaneIndex };
    case "replay_remainder_lane":
      return { id: makeId("state_rail", "lane", "replay_remainder"), nextClusterLaneIndex: clusterLaneIndex };
    case "state_rail_frame":
    case "state_rail_frame_top":
    case "state_rail_frame_bottom":
    case "state_rail_frame_left":
    case "state_rail_frame_right":
      return { id: makeId("state_rail", "frame"), nextClusterLaneIndex: clusterLaneIndex };
    case "actor_cluster_strip_bg":
      return { id: makeId("cluster_strip", "background"), nextClusterLaneIndex: clusterLaneIndex };
    case "actor_cluster_strip_frame":
    case "actor_cluster_strip_frame_top":
    case "actor_cluster_strip_frame_bottom":
    case "actor_cluster_strip_frame_left":
    case "actor_cluster_strip_frame_right":
      return { id: makeId("cluster_strip", "frame"), nextClusterLaneIndex: clusterLaneIndex };
    case "actor_cluster_segment_system":
    case "actor_cluster_segment_process":
    case "actor_cluster_segment_file":
    case "actor_cluster_segment_snapshot":
    case "actor_cluster_segment_replay_prefix":
    case "actor_cluster_segment_empty": {
      const idx = clusterLaneIndex + 1;
      const c = scene.clusters[idx];
      return {
        id: c ? boundedSelectionIdCluster(c.id) : makeId("cluster", "unknown", String(idx)),
        nextClusterLaneIndex: idx,
      };
    }
    case "actor_cluster_emphasis_bar": {
      const c = scene.clusters[clusterLaneIndex];
      return {
        id: c ? boundedSelectionIdCluster(c.id) : makeId("cluster", "unknown", String(clusterLaneIndex)),
        nextClusterLaneIndex: clusterLaneIndex,
      };
    }
    default:
      return { id: null, nextClusterLaneIndex: clusterLaneIndex };
  }
}

function rectFromPrimitive(p: DrawablePrimitive): { x: number; y: number; width: number; height: number } {
  return { x: p.x, y: p.y, width: p.width, height: p.height };
}

/**
 * Hit targets in **paint order** (first = bottom). Hit-test with `hitTestBoundedSelection` (last wins).
 */
export function buildBoundedSelectionHitTargetsFromPrimitives(
  scene: GlassSceneV0,
  primitives: readonly DrawablePrimitive[],
): BoundedSelectionHitTarget[] {
  const out: BoundedSelectionHitTarget[] = [];
  let clusterLaneIdx = -1;
  for (const pr of primitives) {
    const { id, nextClusterLaneIndex } = mapPrimitiveTagToSelectionId(pr, scene, clusterLaneIdx);
    clusterLaneIdx = nextClusterLaneIndex;
    if (!id) {
      continue;
    }
    const r = rectFromPrimitive(pr);
    if (r.width <= 0 || r.height <= 0) {
      continue;
    }
    out.push({ id, ...r });
  }
  return out;
}

/**
 * Overlay text lines (Canvas overlay only) — same vertical rhythm as `drawLiveVisualTextLabelsIntoContext`.
 */
export function buildBoundedSelectionTextOverlayHitTargets(
  spec: LiveVisualSpec,
  widthCss: number,
  heightCss: number,
): BoundedSelectionHitTarget[] {
  const w = widthCss;
  const h = heightCss;
  const railBottom = LIVE_VISUAL_STATE_RAIL_LAYOUT.originY + LIVE_VISUAL_STATE_RAIL_LAYOUT.height;
  const clusterBottom =
    spec.actorClusterSummaryLine !== null && spec.actorClusterSummaryLine.length > 0
      ? LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT.originY + LIVE_VISUAL_ACTOR_CLUSTER_STRIP_LAYOUT.height
      : railBottom;
  let lineY = clusterBottom + 8;
  const left = 16;
  const lineW = w - 32;
  const lineH = 14;
  const out: BoundedSelectionHitTarget[] = [];

  const pushLine = (id: string) => {
    out.push({ id, x: left, y: lineY - 11, width: lineW, height: lineH + 4 });
    lineY += 14;
  };

  if (spec.boundedCompositionCaption) {
    pushLine(makeId("overlay", "composition_caption"));
  }
  if (spec.boundedEmphasisSummaryLine) {
    pushLine(makeId("overlay", "emphasis_summary"));
  }
  if (spec.boundedFocusCaptionLine) {
    pushLine(makeId("overlay", "focus_caption"));
  }
  if (spec.actorClusterSummaryLine) {
    pushLine(makeId("overlay", "cluster_summary"));
  }

  pushLine(makeId("overlay", "wire_mode_tail_session"));
  if (spec.stripSource === "live") {
    pushLine(makeId("node", "n_fact_snapshot"));
  } else if (spec.replayPrefixFraction !== null) {
    pushLine(makeId("overlay", "replay_prefix_caption"));
  } else {
    pushLine(makeId("overlay", "replay_prefix_caption"));
  }

  pushLine(makeId("overlay", "last_wire"));
  if (spec.reconcileSummary) {
    pushLine(makeId("overlay", "http_reconcile_line"));
  }
  if (lineY < h - 12) {
    out.push({
      id: makeId("overlay", "honesty_footer"),
      x: left,
      y: h - 18,
      width: lineW,
      height: 14,
    });
  }
  return out.filter((t) => t.y + t.height >= 0 && t.y < h);
}

export function mergeBoundedSelectionHitTargets(
  geometry: readonly BoundedSelectionHitTarget[],
  overlay: readonly BoundedSelectionHitTarget[],
): BoundedSelectionHitTarget[] {
  return [...geometry, ...overlay];
}

/** Geometry + Canvas text overlay rects — same basis as hit testing the interactive surface. */
export function buildBoundedSelectionHitTargetsForScene(
  scene: GlassSceneV0,
  layout?: Pick<SceneBounds, "widthCss" | "heightCss">,
  focusedSelectionId?: string | null,
): BoundedSelectionHitTarget[] {
  const primitives = sceneToDrawablePrimitives(scene, layout, { focusedSelectionId });
  const spec = liveVisualSpecFromScene(scene, focusedSelectionId);
  const w = layout?.widthCss ?? scene.bounds.widthCss;
  const h = layout?.heightCss ?? scene.bounds.heightCss;
  const geo = buildBoundedSelectionHitTargetsFromPrimitives(scene, primitives);
  const overlay = buildBoundedSelectionTextOverlayHitTargets(spec, w, h);
  return mergeBoundedSelectionHitTargets(geo, overlay);
}

export function hitTestBoundedSelection(
  xCss: number,
  yCss: number,
  targetsPaintOrder: readonly BoundedSelectionHitTarget[],
): string | null {
  for (let i = targetsPaintOrder.length - 1; i >= 0; i--) {
    const t = targetsPaintOrder[i];
    if (!t) {
      continue;
    }
    if (xCss >= t.x && xCss <= t.x + t.width && yCss >= t.y && yCss <= t.y + t.height) {
      return t.id;
    }
  }
  return null;
}

export function unionBoundingRectForSelectionId(
  id: string,
  targets: readonly BoundedSelectionHitTarget[],
): { x: number; y: number; width: number; height: number } | null {
  const matches = targets.filter((t) => t.id === id);
  if (matches.length === 0) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of matches) {
    minX = Math.min(minX, t.x);
    minY = Math.min(minY, t.y);
    maxX = Math.max(maxX, t.x + t.width);
    maxY = Math.max(maxY, t.y + t.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Bounded inspector facts — no hidden authority; only scene + optional spec-derived strings.
 */
export function buildBoundedInspectorLines(
  scene: GlassSceneV0,
  spec: LiveVisualSpec,
  selectedId: string | null,
): string[] {
  if (selectedId === null) {
    return [
      "Selection: (none)",
      "Click a scene band, region panel, rail lane, cluster segment, or an overlay line.",
      "This does not imply topology, process history, or causal graph edges.",
    ];
  }

  const lines: string[] = [`Selected: ${selectedId}`];
  const focus = computeBoundedSceneFocus(scene, selectedId);
  if (focus.active) {
    lines.push(`Focus mode: ${focus.provenanceFocusLine ?? focus.captionLine ?? "(active)"}`);
    if (focus.relatedRegionIds.length > 0) {
      lines.push(`Related regions (grouping only): ${focus.relatedRegionIds.join(", ")}`);
    }
  }
  if (spec.boundedStripReflowLine) {
    lines.push(`Strip reflow (spatial): ${spec.boundedStripReflowLine}`);
  }

  const pushHonesty = () => {
    lines.push(
      "Does not imply: full topology, syscall-complete graph, or durable history beyond the current bounded sample.",
    );
  };

  if (selectedId.startsWith(`${BOUNDED_SELECTION_ID_PREFIX}:region:`)) {
    const rid = selectedId.slice(`${BOUNDED_SELECTION_ID_PREFIX}:region:`.length);
    const reg = scene.regions.find((r) => r.id === rid);
    if (reg) {
      lines.push(`Region: ${reg.label}`);
      lines.push(`Role: ${reg.role}`);
      lines.push(`Member zones (grouping): ${reg.memberZoneIds.join(", ")}`);
    } else {
      lines.push("Region metadata missing from current scene.");
    }
    lines.push(`Wire mode (last-applied WS presentation): ${spec.mode}`);
    lines.push(`Snapshot origin label (if any): ${spec.snapshotOriginLabel ?? "—"}`);
    pushHonesty();
    return lines;
  }

  if (selectedId.startsWith(`${BOUNDED_SELECTION_ID_PREFIX}:cluster:`)) {
    const cid = selectedId.slice(`${BOUNDED_SELECTION_ID_PREFIX}:cluster:`.length);
    const cl = scene.clusters.find((c) => c.id === cid);
    if (cl) {
      lines.push(`Cluster lane: ${cl.lane}`);
      lines.push(`Label: ${cl.label}`);
      lines.push(`Sample count (bounded): ${cl.sampleCount}`);
      lines.push(`Emphasis (0–1): ${cl.emphasis01.toFixed(3)}`);
    } else {
      lines.push("Cluster not found in current scene.");
    }
    lines.push(`Scene sample scope: ${scene.honesty.sampleScope}`);
    lines.push(`Honesty: ${scene.honesty.line}`);
    pushHonesty();
    return lines;
  }

  if (selectedId.startsWith(`${BOUNDED_SELECTION_ID_PREFIX}:node:`)) {
    const nid = selectedId.slice(`${BOUNDED_SELECTION_ID_PREFIX}:node:`.length);
    const node = scene.nodes.find((n) => n.id === nid);
    if (node && node.kind === "fact_card") {
      const key = String(node.payload.key ?? "");
      const val = String(node.payload.value ?? "");
      lines.push(`Fact card: ${key}`);
      lines.push(`Value: ${val}`);
    } else if (nid === "n_fact_snapshot") {
      lines.push(`snapshot_origin: ${spec.snapshotOriginLabel ?? "—"}`);
    } else if (nid === "n_fact_reconcile") {
      lines.push(`HTTP reconcile summary: ${spec.reconcileSummary ?? "—"}`);
    } else {
      lines.push("Fact node not present or not a typed fact card in this compile.");
    }
    lines.push(`Session: ${scene.sessionLabel}`);
    lines.push(`Wire mode: ${spec.mode}`);
    pushHonesty();
    return lines;
  }

  if (selectedId.includes(":tick:")) {
    lines.push("Wire slot tick (R / A / Rz presentation — not a causal edge).");
    lines.push(`Current mode: ${spec.mode}`);
    lines.push(`Last wire message: ${spec.lastWireMsg ?? "—"}`);
    pushHonesty();
    return lines;
  }

  if (selectedId.includes(":http:")) {
    lines.push("HTTP reconcile chip (bounded F-04 snapshot presentation vs WS tail).");
    lines.push(`Reconcile summary: ${spec.reconcileSummary ?? "—"}`);
    lines.push(`Warning: ${spec.warningCode ?? "—"} · Resync: ${spec.resyncReason ?? "—"}`);
    pushHonesty();
    return lines;
  }

  if (selectedId.includes(":state_rail:")) {
    lines.push("State rail segment (bounded snapshot / resync / warning or replay prefix split).");
    if (scene.source === "replay") {
      lines.push(`Replay cursor index: ${scene.replayCursorIndex ?? "—"} / ${scene.replayEventTotal ?? "—"}`);
      lines.push(`Replay prefix fraction: ${scene.replayPrefixFraction ?? "—"}`);
    } else {
      lines.push(`Snapshot origin: ${spec.snapshotOriginLabel ?? "—"}`);
    }
    lines.push(`Resync reason: ${spec.resyncReason ?? "—"}`);
    lines.push(`Warning code: ${spec.warningCode ?? "—"}`);
    pushHonesty();
    return lines;
  }

  if (selectedId.includes(":wire:")) {
    lines.push("Wire update band (mode-colored density + ticks).");
    lines.push(`Mode: ${spec.mode} · tail count: ${spec.eventTailCount}`);
    lines.push(`Last wire: ${spec.lastWireMsg ?? "—"}`);
    pushHonesty();
    return lines;
  }

  if (selectedId.startsWith(`${BOUNDED_SELECTION_ID_PREFIX}:overlay:`)) {
    lines.push("Overlay text line (Canvas overlay — same facts as the strip; not a second authority).");
    if (selectedId.endsWith(":wire_mode_tail_session")) {
      lines.push(`mode=${spec.mode} · tail=${spec.eventTailCount} · session=${spec.sessionId}`);
    }
    if (selectedId.endsWith(":replay_prefix_caption")) {
      if (spec.replayPrefixFraction !== null) {
        lines.push(`Replay prefix: ${Math.round(spec.replayPrefixFraction * 100)}% of pack`);
      } else {
        lines.push("Replay: no prefix split (load / empty)");
      }
    }
    if (selectedId.endsWith(":last_wire")) {
      lines.push(`last wire: ${spec.lastWireMsg ?? "(none)"}`);
    }
    if (selectedId.endsWith(":http_reconcile_line")) {
      lines.push(`HTTP reconcile: ${spec.reconcileSummary ?? "—"}`);
    }
    if (selectedId.endsWith(":focus_caption")) {
      lines.push(`Bounded focus caption: ${spec.boundedFocusCaptionLine ?? "—"}`);
    }
    pushHonesty();
    return lines;
  }

  lines.push(`Scene honesty: ${scene.honesty.line}`);
  pushHonesty();
  return lines;
}

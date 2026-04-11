/**
 * Vertical Slice v6 — bounded focus mode derived from selection + Scene v0 grouping only.
 * No graph traversal, no inferred topology — dim/emphasis tiers are explainable from regions/zones/clusters.
 */

import type { GlassSceneV0, SceneBoundedRegion, SceneBoundedRegionRole } from "./glassSceneV0.js";
import type { DrawablePrimitive } from "./drawablePrimitivesV0.js";
import type { BoundedStripLayoutV0 } from "./boundedSceneFocusReflow.js";
import {
  clusterSegmentBoundsFromLayout,
  defaultBoundedStripLayout,
  focusRectForRegionRoleWithLayout,
} from "./boundedSceneFocusReflow.js";

/** Must match `BOUNDED_SELECTION_ID_PREFIX` in `boundedSceneSelection.ts` (no import — avoids cycle). */
const SEL_PREFIX = "glass.sel.v0" as const;

export const BOUNDED_FOCUS_MODEL_KIND = "glass.focus.v0" as const;

/** Vertical bands of the fixed strip layout (not graph layers). */
export type BoundedFocusVerticalBand = "primary_wire" | "system_rail" | "evidence_strip";

export interface BoundedSceneFocusV0 {
  kind: typeof BOUNDED_FOCUS_MODEL_KIND;
  /** True when a selection drives cross-dimming or emphasis (overlay-only may set caption without dim). */
  active: boolean;
  selectionId: string | null;
  /** Primary band for readability / caption — null when focus is frame-only or honesty overlay. */
  emphasizedVerticalBand: BoundedFocusVerticalBand | null;
  focusedClusterId: string | null;
  focusedRegionId: string | null;
  dimPrimaryWire: boolean;
  dimSystemRail: boolean;
  dimEvidenceStrip: boolean;
  /** Region ids that stay visually related (grouping membership only — not edges). */
  relatedRegionIds: readonly string[];
  /** Canvas overlay line after emphasis (null = hide). */
  captionLine: string | null;
  /** Short fragment for provenance strip (null = omit). */
  provenanceFocusLine: string | null;
}

const INACTIVE: BoundedSceneFocusV0 = {
  kind: BOUNDED_FOCUS_MODEL_KIND,
  active: false,
  selectionId: null,
  emphasizedVerticalBand: null,
  focusedClusterId: null,
  focusedRegionId: null,
  dimPrimaryWire: false,
  dimSystemRail: false,
  dimEvidenceStrip: false,
  relatedRegionIds: [],
  captionLine: null,
  provenanceFocusLine: null,
};

function roleToBand(role: SceneBoundedRegionRole): BoundedFocusVerticalBand {
  switch (role) {
    case "primary_wire_sample":
      return "primary_wire";
    case "system_integrity_rail":
      return "system_rail";
    case "bounded_sample_evidence":
      return "evidence_strip";
  }
}

function regionById(scene: GlassSceneV0, id: string): SceneBoundedRegion | undefined {
  return scene.regions.find((r) => r.id === id);
}

function makeFocus(
  partial: Omit<BoundedSceneFocusV0, "kind"> & Partial<Pick<BoundedSceneFocusV0, "kind">>,
): BoundedSceneFocusV0 {
  return { kind: BOUNDED_FOCUS_MODEL_KIND, ...partial } as BoundedSceneFocusV0;
}

/**
 * Blend sRGB hex toward a neutral slate (deterministic dimming — not alpha compositing).
 */
export function dimHexColor(hex: string, amount: number): string {
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) {
    return hex;
  }
  const towardR = 148;
  const towardG = 163;
  const towardB = 184;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const t = Math.min(1, Math.max(0, amount));
  const mix = (x: number, tx: number) => Math.round(x + (tx - x) * t);
  const out = (n: number) => n.toString(16).padStart(2, "0");
  return `#${out(mix(r, towardR))}${out(mix(g, towardG))}${out(mix(b, towardB))}`;
}

/**
 * Pure: current scene + optional selection id → bounded focus state for renderers and copy.
 */
export function computeBoundedSceneFocus(
  scene: GlassSceneV0,
  selectedId: string | null,
): BoundedSceneFocusV0 {
  if (selectedId === null || selectedId.length === 0) {
    return { ...INACTIVE };
  }

  if (selectedId.startsWith(`${SEL_PREFIX}:region:`)) {
    const rid = selectedId.slice(`${SEL_PREFIX}:region:`.length);
    const reg = regionById(scene, rid);
    if (!reg) {
      return makeFocus({
        ...INACTIVE,
        active: true,
        selectionId: selectedId,
        captionLine: "unknown region id",
        provenanceFocusLine: `focus=region · id=${rid}`,
      });
    }
    const band = roleToBand(reg.role);
    const dimP = band !== "primary_wire";
    const dimS = band !== "system_rail";
    const dimE = band !== "evidence_strip";
    return makeFocus({
      active: true,
      selectionId: selectedId,
      emphasizedVerticalBand: band,
      focusedClusterId: null,
      focusedRegionId: rid,
      dimPrimaryWire: dimP,
      dimSystemRail: dimS,
      dimEvidenceStrip: dimE,
      relatedRegionIds: [rid],
      captionLine: `region · ${shortRole(reg.role)} · ${reg.label}`,
      provenanceFocusLine: `focus=${band} · region=${rid}`,
    });
  }

  if (selectedId.startsWith(`${SEL_PREFIX}:cluster:`)) {
    const cid = selectedId.slice(`${SEL_PREFIX}:cluster:`.length);
    const cl = scene.clusters.find((c) => c.id === cid);
    const ev = scene.regions.find((r) => r.role === "bounded_sample_evidence");
    return makeFocus({
      active: true,
      selectionId: selectedId,
      emphasizedVerticalBand: "evidence_strip",
      focusedClusterId: cid,
      focusedRegionId: null,
      dimPrimaryWire: true,
      dimSystemRail: true,
      dimEvidenceStrip: false,
      relatedRegionIds: ev ? [ev.id] : [],
      captionLine: cl ? `cluster · ${cl.label} (${cl.lane})` : `cluster · ${cid}`,
      provenanceFocusLine: `focus=evidence_strip · cluster=${cid}`,
    });
  }

  if (
    selectedId.includes(":wire:") ||
    selectedId.includes(":tick:") ||
    selectedId.includes(":http:")
  ) {
    const pw = scene.regions.find((r) => r.role === "primary_wire_sample");
    return makeFocus({
      active: true,
      selectionId: selectedId,
      emphasizedVerticalBand: "primary_wire",
      focusedClusterId: null,
      focusedRegionId: pw?.id ?? null,
      dimPrimaryWire: false,
      dimSystemRail: true,
      dimEvidenceStrip: true,
      relatedRegionIds: pw ? [pw.id] : [],
      captionLine: "wire band · mode / density / ticks / HTTP chip",
      provenanceFocusLine: "focus=primary_wire",
    });
  }

  if (selectedId.includes(":state_rail:")) {
    const sys = scene.regions.find((r) => r.role === "system_integrity_rail");
    return makeFocus({
      active: true,
      selectionId: selectedId,
      emphasizedVerticalBand: "system_rail",
      focusedClusterId: null,
      focusedRegionId: sys?.id ?? null,
      dimPrimaryWire: true,
      dimSystemRail: false,
      dimEvidenceStrip: true,
      relatedRegionIds: sys ? [sys.id] : [],
      captionLine: "state rail · snapshot / resync / replay prefix lanes",
      provenanceFocusLine: "focus=system_rail",
    });
  }

  if (selectedId.includes(":overlay:")) {
    if (
      selectedId.endsWith(":node:n_fact_snapshot") ||
      selectedId.includes("n_fact_snapshot")
    ) {
      const sys = scene.regions.find((r) => r.role === "system_integrity_rail");
      return makeFocus({
        active: true,
        selectionId: selectedId,
        emphasizedVerticalBand: "system_rail",
        focusedClusterId: null,
        focusedRegionId: sys?.id ?? null,
        dimPrimaryWire: true,
        dimSystemRail: false,
        dimEvidenceStrip: true,
        relatedRegionIds: sys ? [sys.id] : [],
        captionLine: "overlay · snapshot_origin line",
        provenanceFocusLine: "focus=system_rail · overlay=snapshot",
      });
    }
    if (selectedId.endsWith(":http_reconcile_line")) {
      const sys = scene.regions.find((r) => r.role === "system_integrity_rail");
      return makeFocus({
        active: true,
        selectionId: selectedId,
        emphasizedVerticalBand: "system_rail",
        focusedClusterId: null,
        focusedRegionId: sys?.id ?? null,
        dimPrimaryWire: true,
        dimSystemRail: false,
        dimEvidenceStrip: true,
        relatedRegionIds: sys ? [sys.id] : [],
        captionLine: "overlay · HTTP reconcile line",
        provenanceFocusLine: "focus=system_rail · overlay=http",
      });
    }
    if (
      selectedId.endsWith(":wire_mode_tail_session") ||
      selectedId.endsWith(":last_wire")
    ) {
      const pw = scene.regions.find((r) => r.role === "primary_wire_sample");
      return makeFocus({
        active: true,
        selectionId: selectedId,
        emphasizedVerticalBand: "primary_wire",
        focusedClusterId: null,
        focusedRegionId: pw?.id ?? null,
        dimPrimaryWire: false,
        dimSystemRail: true,
        dimEvidenceStrip: true,
        relatedRegionIds: pw ? [pw.id] : [],
        captionLine: "overlay · wire / mode line",
        provenanceFocusLine: "focus=primary_wire · overlay=wire",
      });
    }
    if (selectedId.endsWith(":cluster_summary")) {
      const ev = scene.regions.find((r) => r.role === "bounded_sample_evidence");
      return makeFocus({
        active: true,
        selectionId: selectedId,
        emphasizedVerticalBand: "evidence_strip",
        focusedClusterId: null,
        focusedRegionId: ev?.id ?? null,
        dimPrimaryWire: true,
        dimSystemRail: true,
        dimEvidenceStrip: false,
        relatedRegionIds: ev ? [ev.id] : [],
        captionLine: "overlay · cluster summary",
        provenanceFocusLine: "focus=evidence_strip · overlay=clusters",
      });
    }
    if (selectedId.endsWith(":honesty_footer")) {
      return makeFocus({
        active: true,
        selectionId: selectedId,
        emphasizedVerticalBand: null,
        focusedClusterId: null,
        focusedRegionId: null,
        dimPrimaryWire: false,
        dimSystemRail: false,
        dimEvidenceStrip: false,
        relatedRegionIds: [],
        captionLine: "overlay · honesty footer",
        provenanceFocusLine: "focus=overlay · honesty",
      });
    }
    if (selectedId.endsWith(":replay_prefix_caption")) {
      const sys = scene.regions.find((r) => r.role === "system_integrity_rail");
      return makeFocus({
        active: true,
        selectionId: selectedId,
        emphasizedVerticalBand: "system_rail",
        focusedClusterId: null,
        focusedRegionId: sys?.id ?? null,
        dimPrimaryWire: true,
        dimSystemRail: false,
        dimEvidenceStrip: true,
        relatedRegionIds: sys ? [sys.id] : [],
        captionLine: "overlay · replay prefix caption",
        provenanceFocusLine: "focus=system_rail · overlay=replay",
      });
    }
    if (selectedId.endsWith(":composition_caption") || selectedId.endsWith(":emphasis_summary")) {
      return makeFocus({
        active: true,
        selectionId: selectedId,
        emphasizedVerticalBand: null,
        focusedClusterId: null,
        focusedRegionId: null,
        dimPrimaryWire: false,
        dimSystemRail: false,
        dimEvidenceStrip: false,
        relatedRegionIds: [],
        captionLine: selectedId.endsWith(":emphasis_summary")
          ? "overlay · emphasis summary"
          : "overlay · composition caption",
        provenanceFocusLine: "focus=overlay · meta",
      });
    }
  }

  if (selectedId.startsWith(`${SEL_PREFIX}:node:`)) {
    const nid = selectedId.slice(`${SEL_PREFIX}:node:`.length);
    if (nid === "n_fact_snapshot") {
      const sys = scene.regions.find((r) => r.role === "system_integrity_rail");
      return makeFocus({
        active: true,
        selectionId: selectedId,
        emphasizedVerticalBand: "system_rail",
        focusedClusterId: null,
        focusedRegionId: sys?.id ?? null,
        dimPrimaryWire: true,
        dimSystemRail: false,
        dimEvidenceStrip: true,
        relatedRegionIds: sys ? [sys.id] : [],
        captionLine: "fact · snapshot_origin",
        provenanceFocusLine: "focus=system_rail · fact=snapshot",
      });
    }
    return makeFocus({
      active: true,
      selectionId: selectedId,
      emphasizedVerticalBand: null,
      focusedClusterId: null,
      focusedRegionId: null,
      dimPrimaryWire: false,
      dimSystemRail: false,
      dimEvidenceStrip: false,
      relatedRegionIds: [],
      captionLine: `fact node · ${nid}`,
      provenanceFocusLine: `focus=fact · ${nid}`,
    });
  }

  if (selectedId.includes(":cluster_strip:")) {
    const ev = scene.regions.find((r) => r.role === "bounded_sample_evidence");
    return makeFocus({
      active: true,
      selectionId: selectedId,
      emphasizedVerticalBand: "evidence_strip",
      focusedClusterId: null,
      focusedRegionId: ev?.id ?? null,
      dimPrimaryWire: true,
      dimSystemRail: true,
      dimEvidenceStrip: false,
      relatedRegionIds: ev ? [ev.id] : [],
      captionLine: "cluster strip",
      provenanceFocusLine: "focus=evidence_strip",
    });
  }

  if (selectedId.includes(":bounded_scene_frame")) {
    return makeFocus({
      active: true,
      selectionId: selectedId,
      emphasizedVerticalBand: null,
      focusedClusterId: null,
      focusedRegionId: null,
      dimPrimaryWire: false,
      dimSystemRail: false,
      dimEvidenceStrip: false,
      relatedRegionIds: [],
      captionLine: "bounded scene frame",
      provenanceFocusLine: "focus=frame",
    });
  }

  return makeFocus({
    active: true,
    selectionId: selectedId,
    emphasizedVerticalBand: null,
    focusedClusterId: null,
    focusedRegionId: null,
    dimPrimaryWire: false,
    dimSystemRail: false,
    dimEvidenceStrip: false,
    relatedRegionIds: [],
    captionLine: "focus · selection",
    provenanceFocusLine: "focus=selection",
  });
}

function shortRole(role: SceneBoundedRegionRole): string {
  switch (role) {
    case "primary_wire_sample":
      return "Wire";
    case "system_integrity_rail":
      return "System";
    case "bounded_sample_evidence":
      return "Evidence";
  }
}

const DIM_STRENGTH = 0.36;
const DIM_CLUSTER_OTHER = 0.5;

function isPrimaryWireTag(tag: string): boolean {
  return (
    tag === "density_band" ||
    tag.startsWith("tick_slot_") ||
    tag.startsWith("http_chip_") ||
    (tag.startsWith("band_frame") && !tag.includes("state_rail") && !tag.includes("actor_cluster")) ||
    tag === "composition_panel_primary" ||
    tag === "composition_accent_primary" ||
    tag === "emphasis_wire_pulse_overlay" ||
    tag === "emphasis_sample_pulse_overlay" ||
    tag === "emphasis_replay_cursor_pulse_overlay"
  );
}

function isSystemRailTag(tag: string): boolean {
  return (
    tag === "state_rail_bg" ||
    tag === "state_rail_snapshot_lane" ||
    tag === "state_rail_resync_lane" ||
    tag === "state_rail_warning_lane" ||
    tag === "replay_prefix_lane" ||
    tag === "replay_remainder_lane" ||
    tag.startsWith("state_rail_frame") ||
    tag === "composition_panel_system" ||
    tag === "composition_accent_system" ||
    tag === "composition_separator_system_evidence" ||
    tag === "emphasis_state_rail_attention_overlay"
  );
}

function isEvidenceTag(tag: string): boolean {
  return (
    tag === "actor_cluster_strip_bg" ||
    tag.startsWith("actor_cluster_segment_") ||
    tag === "actor_cluster_emphasis_bar" ||
    tag.startsWith("actor_cluster_strip_frame") ||
    tag === "composition_panel_evidence" ||
    tag === "composition_accent_evidence"
  );
}

/**
 * Mutates primitive list: dims non-focused bands and adds focus strokes (Canvas/WebGPU same stream).
 */
export function applyBoundedSceneFocusToPrimitives(
  scene: GlassSceneV0,
  focus: BoundedSceneFocusV0,
  widthCss: number,
  heightCss: number,
  out: DrawablePrimitive[],
  stripLayout: BoundedStripLayoutV0,
): void {
  void heightCss;
  if (!focus.active) {
    return;
  }
  const dim = DIM_STRENGTH;
  const anyDim = focus.dimPrimaryWire || focus.dimSystemRail || focus.dimEvidenceStrip;

  for (const p of out) {
    if (p.kind === "fill_rect") {
      const tag = p.semanticTag;
      if (tag === "band_background" && anyDim) {
        p.fillColorHex = dimHexColor(p.fillColorHex, dim * 0.35);
        continue;
      }
      if (focus.dimPrimaryWire && isPrimaryWireTag(tag)) {
        p.fillColorHex = dimHexColor(p.fillColorHex, dim);
      } else if (focus.dimSystemRail && isSystemRailTag(tag)) {
        p.fillColorHex = dimHexColor(p.fillColorHex, dim);
      } else if (focus.dimEvidenceStrip && isEvidenceTag(tag)) {
        p.fillColorHex = dimHexColor(p.fillColorHex, dim);
      }
    } else if (p.kind === "stroke_rect") {
      const tag = p.semanticTag;
      if (focus.dimPrimaryWire && isPrimaryWireTag(tag)) {
        p.strokeColorHex = dimHexColor(p.strokeColorHex, dim);
      } else if (focus.dimSystemRail && isSystemRailTag(tag)) {
        p.strokeColorHex = dimHexColor(p.strokeColorHex, dim);
      } else if (focus.dimEvidenceStrip && isEvidenceTag(tag)) {
        p.strokeColorHex = dimHexColor(p.strokeColorHex, dim);
      }
    }
  }

  if (focus.focusedClusterId) {
    const ci = scene.clusters.findIndex((c) => c.id === focus.focusedClusterId);
    if (ci >= 0) {
      let lastSegIdx = -1;
      for (const p of out) {
        if (p.kind !== "fill_rect") {
          continue;
        }
        const t = p.semanticTag;
        if (
          t === "actor_cluster_segment_system" ||
          t === "actor_cluster_segment_process" ||
          t === "actor_cluster_segment_file" ||
          t === "actor_cluster_segment_snapshot" ||
          t === "actor_cluster_segment_replay_prefix" ||
          t === "actor_cluster_segment_empty"
        ) {
          lastSegIdx++;
          if (lastSegIdx !== ci) {
            p.fillColorHex = dimHexColor(p.fillColorHex, DIM_CLUSTER_OTHER);
          }
        }
        if (t === "actor_cluster_emphasis_bar") {
          if (lastSegIdx !== ci) {
            p.fillColorHex = dimHexColor(p.fillColorHex, DIM_CLUSTER_OTHER);
          }
        }
      }
    }
  }

  const frameIdx = out.findIndex((p) => p.semanticTag === "composition_bounded_scene_frame");
  const insertAt = frameIdx >= 0 ? frameIdx : out.length;
  const strokes: DrawablePrimitive[] = [];

  if (focus.focusedRegionId) {
    const reg = scene.regions.find((r) => r.id === focus.focusedRegionId);
    if (reg) {
      const r = focusRectForRegionRoleWithLayout(scene, reg.role, widthCss, stripLayout);
      if (r) {
        strokes.push({
          kind: "stroke_rect",
          semanticTag: "focus_region_selection_frame",
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          strokeColorHex: "#b45309",
          lineWidthCss: 2,
        });
      }
    }
  }

  if (focus.focusedClusterId) {
    const ci = scene.clusters.findIndex((c) => c.id === focus.focusedClusterId);
    if (ci >= 0) {
      const b = clusterSegmentBoundsFromLayout(scene, ci, widthCss, stripLayout);
      if (b) {
        strokes.push({
          kind: "stroke_rect",
          semanticTag: "focus_cluster_selection_frame",
          x: b.x - 1,
          y: b.y - 1,
          width: b.width + 2,
          height: b.height + 2,
          strokeColorHex: "#b45309",
          lineWidthCss: 2,
        });
      }
    }
  }

  if (strokes.length > 0) {
    out.splice(insertAt, 0, ...strokes);
  }
}

/** Rectangle for region role in CSS px — idle strip layout (no reflow). */
export function focusRectForRegionRole(
  scene: GlassSceneV0,
  role: SceneBoundedRegionRole,
  widthCss: number,
): { x: number; y: number; width: number; height: number } | null {
  return focusRectForRegionRoleWithLayout(scene, role, widthCss, defaultBoundedStripLayout());
}

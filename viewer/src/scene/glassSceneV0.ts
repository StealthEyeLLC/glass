/**
 * Glass Scene System v0 — bounded, deterministic, DOM-free.
 * Not topology, not full history — explicit sample scope per source.
 */

import type { LiveVisualMode } from "../live/liveVisualModel.js";

export const GLASS_SCENE_V0 = "glass.scene.v0" as const;

export type SceneSource = "replay" | "live";

/** How the bounded sample is scoped (honesty for legend / tooling). */
export type SceneSampleScope =
  | "live_ws_tail"
  | "replay_index_prefix"
  | "empty"
  | "load_error";

export interface SceneBounds {
  widthCss: number;
  heightCss: number;
}

export type SceneZoneKind =
  | "primary_band"
  | "density_lane"
  | "marker_lane"
  | "annotation"
  | "provenance_hook"
  /** Vertical Slice v1 — bounded state rail (Drawable Primitives), not topology */
  | "state_rail";

export interface SceneZone {
  id: string;
  kind: SceneZoneKind;
  /** Short implementation-facing label */
  label: string;
}

export type SceneNodeKind =
  | "mode_band"
  | "density_value"
  | "playback_badge"
  | "cursor_position"
  | "text_annotation"
  /** Key/value fact from current wire or HTTP — no graph semantics */
  | "fact_card"
  /** Vertical Slice v2 — one bounded cluster lane (counts from current sample only) */
  | "cluster_lane";

/** Honest bounded lane — not a process tree, not cross-event causality. */
export type SceneActorClusterLane =
  | "system_attention"
  | "process_samples"
  | "file_samples"
  | "snapshot_origin"
  | "replay_index_prefix"
  | "empty_sample";

export interface SceneActorCluster {
  id: string;
  lane: SceneActorClusterLane;
  label: string;
  sampleCount: number;
  /** 0–1 emphasis for drawable bar (from count/cap or active severity). */
  emphasis01: number;
}

/**
 * Vertical Slice v3 — bounded region roles (membership references `SceneZone.id`; not graph edges).
 */
export type SceneBoundedRegionRole =
  | "primary_wire_sample"
  | "system_integrity_rail"
  | "bounded_sample_evidence";

export interface SceneBoundedRegion {
  id: string;
  role: SceneBoundedRegionRole;
  /** Human-readable; must not imply topology or full history. */
  label: string;
  /** Zone ids grouped under this region — adjacency/grouping only. */
  memberZoneIds: readonly string[];
}

export interface SceneNode {
  id: string;
  zoneId: string;
  kind: SceneNodeKind;
  /** Small bounded payload — string/number/bool only */
  payload: Record<string, string | number | boolean | null | undefined>;
}

/** Honest edge: only ordering/temporal hints we actually have (no process tree). */
export type SceneEdgeKind = "sequential_in_tail" | "replay_cursor_points_at";

export interface SceneEdge {
  id: string;
  kind: SceneEdgeKind;
  fromNodeId: string;
  toNodeId: string;
  note?: string;
}

export interface SceneHonesty {
  sampleScope: SceneSampleScope;
  /** Shown as footer / legend — must stay non-authoritative */
  line: string;
}

/**
 * Single bounded visual scene: same family for replay and live.
 * `wireMode` + counts align with `LiveVisualSpec` where applicable.
 */
export interface GlassSceneV0 {
  kind: typeof GLASS_SCENE_V0;
  source: SceneSource;
  bounds: SceneBounds;
  wireMode: LiveVisualMode;
  /** Session id (live) or pack session id / placeholder (replay) */
  sessionLabel: string;
  /** Bounded count driving density (live: WS tail length; replay: prefix length cursor+1) */
  boundedSampleCount: number;
  /** Optional total for density denominator (replay: pack size; live: may be omitted) */
  totalEventCardinality: number | null;
  density01: number;
  lastWireMsg: string | null;
  lastWireSummary: string | null;
  warningCode: string | null;
  resyncReason: string | null;
  reconcileSummary: string | null;
  /** Live: `session_snapshot_replaced.snapshot_origin` or optional HTTP body; replay: null */
  snapshotOriginLabel: string | null;
  /** Replay only: prefix cursor coverage vs pack cardinality (honest split strip); live: null */
  replayPrefixFraction: number | null;
  /** Vertical Slice v2 — bounded actor/sample clusters from current tail or prefix only. */
  clusters: readonly SceneActorCluster[];
  /** Vertical Slice v3 — honest grouping of zones (containers / lanes / emphasis); not edges. */
  regions: readonly SceneBoundedRegion[];
  zones: readonly SceneZone[];
  nodes: readonly SceneNode[];
  edges: readonly SceneEdge[];
  honesty: SceneHonesty;
}

/** Vertical Slice v2 — state rail + actor cluster strip + text. */
export const DEFAULT_SCENE_BOUNDS: SceneBounds = {
  widthCss: 360,
  heightCss: 200,
};

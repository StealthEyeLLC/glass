/**
 * Vertical Slice v3 — bounded region grouping for scene composition (membership only, not graph edges).
 */

import type { SceneBoundedRegion, SceneBoundedRegionRole } from "./glassSceneV0.js";

const LIVE_PRIMARY: readonly string[] = ["z_wire", "z_sample", "z_markers"];
const LIVE_SYSTEM: readonly string[] = ["z_snapshot", "z_reconcile", "z_state_rail"];
const LIVE_EVIDENCE: readonly string[] = ["z_actor"];

const REPLAY_PRIMARY: readonly string[] = ["z_primary", "z_density", "z_playback"];
const REPLAY_SYSTEM: readonly string[] = ["z_snapshot", "z_state_rail"];
const REPLAY_EVIDENCE: readonly string[] = ["z_actor"];

function region(
  id: string,
  role: SceneBoundedRegionRole,
  label: string,
  memberZoneIds: readonly string[],
): SceneBoundedRegion {
  return { id, role, label, memberZoneIds };
}

/** Live: wire/tail density vs F-04 + reconcile rail vs cluster evidence. */
export function buildLiveBoundedRegions(): SceneBoundedRegion[] {
  return [
    region(
      "reg_primary_wire",
      "primary_wire_sample",
      "Current wire update & bounded WS tail density (active)",
      LIVE_PRIMARY,
    ),
    region(
      "reg_system_integrity",
      "system_integrity_rail",
      "Snapshot origin, reconcile/resync, bounded state rail (system context)",
      LIVE_SYSTEM,
    ),
    region(
      "reg_bounded_evidence",
      "bounded_sample_evidence",
      "Actor/sample clusters from current tail only (bounded evidence)",
      LIVE_EVIDENCE,
    ),
  ];
}

/** Replay: prefix playback vs snapshot disclaimer + rail vs prefix clusters. */
export function buildReplayBoundedRegions(): SceneBoundedRegion[] {
  return [
    region(
      "reg_primary_wire",
      "primary_wire_sample",
      "Prefix playback & density vs pack (active sample)",
      REPLAY_PRIMARY,
    ),
    region(
      "reg_system_integrity",
      "system_integrity_rail",
      "Replay snapshot disclaimer & prefix/remainder rail (system context)",
      REPLAY_SYSTEM,
    ),
    region(
      "reg_bounded_evidence",
      "bounded_sample_evidence",
      "Actor/sample clusters from index prefix only (bounded evidence)",
      REPLAY_EVIDENCE,
    ),
  ];
}

export function formatBoundedCompositionCaption(regions: readonly SceneBoundedRegion[]): string {
  if (regions.length === 0) {
    return "";
  }
  const short = (role: SceneBoundedRegionRole): string => {
    switch (role) {
      case "primary_wire_sample":
        return "Wire";
      case "system_integrity_rail":
        return "System";
      case "bounded_sample_evidence":
        return "Evidence";
    }
  };
  return regions.map((r) => short(r.role)).join(" · ");
}

/**
 * Pure gate for when the live shell may show bounded trust surfaces (evidence, episodes, claims, receipt).
 * Presentation-only — no wire changes.
 */

import type { LiveSessionModelState } from "./applyLiveSessionMessage.js";
import type { HttpReconcileRecord } from "./liveHttpReconcile.js";
import type { BoundedSnapshotF04 } from "./liveSessionHttp.js";

/**
 * Trust band is allowed only when:
 * - an HTTP snapshot fetch is not in flight (avoids stale panels during F-04 reconcile), and
 * - there is a non-empty bounded WS tail, or a successful HTTP snapshot with at least one event in the body.
 *
 * Control-only wire (e.g. `session_hello`, `session_warning`, empty deltas) does not qualify.
 */
export function liveTrustBandShouldShow(
  model: LiveSessionModelState,
  lastHttp: BoundedSnapshotF04 | null,
  lastReconcile: HttpReconcileRecord | null,
  httpSnapshotInFlight: boolean,
): boolean {
  if (httpSnapshotInFlight) {
    return false;
  }
  if (model.eventTail.length > 0) {
    return true;
  }
  if (
    lastHttp !== null &&
    lastReconcile !== null &&
    lastReconcile.status === "ok" &&
    (lastHttp.events?.length ?? 0) > 0
  ) {
    return true;
  }
  return false;
}

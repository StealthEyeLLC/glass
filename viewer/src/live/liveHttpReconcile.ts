/**
 * Last bounded HTTP snapshot refresh — operator vs automatic after `session_resync_required`.
 */

export type HttpReconcileTrigger = "operator" | "session_resync_required";

export interface HttpReconcileRecord {
  atIso: string;
  trigger: HttpReconcileTrigger;
  status: "ok" | "error";
  /** Event count when status === ok */
  eventsCount?: number;
  errorMessage?: string;
}

export function makeReconcileRecord(
  trigger: HttpReconcileTrigger,
  status: "ok" | "error",
  opts: { eventsCount?: number; errorMessage?: string } = {},
  nowMs: number = Date.now(),
): HttpReconcileRecord {
  return {
    atIso: new Date(nowMs).toISOString(),
    trigger,
    status,
    eventsCount: opts.eventsCount,
    errorMessage: opts.errorMessage,
  };
}

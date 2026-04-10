# F-03 — Live-session backlog, outbound queue, and resync escalation (freeze proposal)

**Implementation (v0):** `glass_bridge::live_session_ws` — per-connection `F03OutboundQueue`, `F03_V0_LIVE_WS_QUEUE_MAX_*`, coalesce-on-overflow + `session_resync_required`, poll-failure resync. This document remains the rationale archive; tracker details live in `docs/PHASE0_FREEZE_TRACKER.md`.

**Authority:** `GLASS_FULL_ENGINEERING_SPEC_v10.md`, `GLASS_V0_BUILD_PLAN.md`.  
**Related (do not conflate):** Bounded-era **F-04** HTTP snapshot is **frozen** — `docs/F03_F04_FREEZE_PROPOSAL.md`, `docs/contracts/bridge_session_snapshot_bounded_v0.schema.json`. This document is **live-era / WebSocket / outbound path** only.

**Purpose:** Give humans explicit choices before implementing a **real** outbound queue, backpressure, and continuity semantics. **This pass does not freeze F-03** — it prepares a decision package.

---

## 1. Four-way separation (read this first)

| Bucket | Meaning in Glass v0 today |
|--------|---------------------------|
| **1. Implemented now** | Behavior that exists in code and tests; may still be labeled provisional. |
| **2. Merely provisional** | Constants, placeholders, or skeleton paths that **must not** be treated as the final contract until humans freeze F-03. |
| **3. Candidates to freeze next** | Decisions listed in §5–§7 that a human should pick **before** building production queue logic. |
| **4. Correctly deferred** | Items that depend on live ingest, transport freeze, or client UX — **not** v0 queue-only work. |

---

## 2. What is implemented now (ground truth)

| Area | Reality |
|------|---------|
| **Authenticated WebSocket path** | `GET /ws` upgrade after bearer auth where bridge requires it; `live_session_subscribe` for a `session_id`. |
| **Session subscription + hello** | JSON envelopes with protocol version; hello may advertise **provisional** backlog hints (e.g. event threshold) — **not** a guarantee of future queue shape. |
| **Retained-state-driven updates** | Bridge **polls** F-IPC on a **provisional** interval; when bounded snapshot **fingerprint** changes, emits `session_snapshot_replaced` with **sampled** events + honesty fields (`continuity`, `honesty`). |
| **Additive live-era reasons** | WebSocket-only `LIVE_WS_REASON_*` strings — **separate** from frozen HTTP `RESYNC_HINT_REASON_*` (`glass_bridge::resync`). |
| **`session_resync_required` skeleton** | Emitted on **provisional** conditions (e.g. outbound `VecDeque` cap, poll failure) with `reason` ∈ `LIVE_WS_REASON_*` and `action: use_http_snapshot`. |
| **Bounded HTTP contract** | **Unchanged** — `GET /sessions/:id/snapshot` remains the authoritative bounded snapshot; F-04 tokens and cursor rules are not altered by live WS. |
| **Tests** | `bridge/tests/ws_live_session.rs` (integration); `live_session_ws` unit tests for queue placeholder + reason separation. |

**Honesty:** The current path is **polling + replacement notices**, not a durable append-only delta log. No **real** multi-producer outbound queue with shared backpressure across sessions exists yet.

---

## 3. What is merely provisional (do not treat as frozen)

| Symbol / behavior | Location | Notes |
|-------------------|----------|--------|
| `PROVISIONAL_LIVE_WS_POLL_INTERVAL_MS` | `glass_bridge::live_session_ws` | Poll cadence; not ingest-driven. |
| `PROVISIONAL_LIVE_WS_OUTBOUND_QUEUE_MAX` | same | **In-memory `VecDeque` per connection** — placeholder; not cross-session fairness. |
| `PROVISIONAL_LIVE_WS_EVENTS_SAMPLE_MAX` | same | Sample size in `session_snapshot_replaced`; full view via HTTP. |
| `PROVISIONAL_BACKLOG_EVENT_THRESHOLD` | `glass_bridge::resync` | Documented for **future** live backlog; **not** wired as enforced WS queue policy in v0 skeleton. |
| `LIVE_WS_REASON_*` | `live_session_ws` | Additive strings; naming ends in `_provisional` where appropriate — **freeze separately** from HTTP `RESYNC_HINT_REASON_*`. |

---

## 4. What should be frozen when F-03 closes (human-owned package)

When ready, humans should freeze at least:

1. **Outbound queue ownership model** (per-connection vs per-session vs hybrid).
2. **Overflow policy** (drop oldest, drop newest, coalesce/replace snapshot, or immediate `session_resync_required`).
3. **Escalation rules** — when `session_resync_required` is mandatory vs optional warning.
4. **Threshold units** — event count only vs bytes + events vs time-based (stall detection).
5. **Continuity claims** — what a client may infer after each message type (see §8).
6. **Relationship to bounded F-04** — HTTP remains source of truth; WS never redefines `resync_hint.reason` tokens.

---

## 5. Decision: outbound queue model

### 5.1 Option A — Per-connection queue (single viewer)

| Aspect | Content |
|--------|---------|
| **Description** | Each WebSocket holds its own bounded FIFO (or deque) of outbound JSON messages. No shared queue across tabs. |
| **Recommended?** | **Yes for v0** — matches current skeleton; minimal cross-session coupling; simple backpressure story. |
| **Rationale** | Aligns with “one subscriber, one poll loop”; avoids bridge-wide lock contention before scale requirements exist. |
| **Implementation impact** | Local struct per task; caps already prototyped as per-connection `VecDeque`. |
| **Test impact** | Per-connection overflow tests; no multi-tenant fairness tests yet. |
| **Operator-visible** | Multiple tabs = duplicate polls to collector; acceptable for dev/small deployments. |
| **Risk if unfrozen** | Ambiguity whether overflow is “global session” vs “this socket” — clients mis-implement retry. |

### 5.2 Option B — Per-session shared queue (fanout)

| Aspect | Content |
|--------|---------|
| **Description** | One outbound queue per `session_id` in bridge; multiple WS clients attach as consumers (broadcast or per-subscriber cursor). |
| **Recommended?** | **Defer** until product requires multi-viewer live + defined fanout semantics. |
| **Rationale** | Requires delivery semantics (at-most-once vs at-least-once), cursor per subscriber, and collector push or bridge merge — **out of v0 skeleton scope**. |
| **Implementation impact** | Large: shared state, reference counting, stall detection across consumers. |
| **Test impact** | Concurrency tests, fairness, memory bounds across subscribers. |
| **Operator-visible** | Lower duplicate F-IPC load; higher bridge memory and complexity. |
| **Risk if chosen prematurely** | Over-engineering before live ingest exists; subtle deadlocks. |

---

## 6. Decision: overflow behavior

### 6.1 Option A — Drop oldest (FIFO trim) + optional resync

| Aspect | Content |
|--------|---------|
| **Description** | On overflow, discard **oldest** queued messages; optionally emit **one** `session_warning` or escalate to `session_resync_required` if loss is material. |
| **Recommended?** | **Plausible default** for streaming UIs that need “latest snapshot” more than full history. |
| **Rationale** | Bounded memory; similar to ring-buffer telemetry. |
| **Implementation impact** | `VecDeque::pop_front` or capped queue; metrics for dropped count. |
| **Test impact** | Assert order + drop count + single escalation. |
| **Operator-visible** | May miss intermediate deltas — must align with §8 client inference. |
| **Risk if unfrozen** | Clients assume “no loss” and drift. |

### 6.2 Option B — Drop newest (backpressure: stop reading ingress)

| Aspect | Content |
|--------|---------|
| **Description** | When outbound queue full, **pause** producer side (stop polling / stop accepting collector events) until drain — or force disconnect. |
| **Recommended?** | **Secondary** — good for strict ordering; risks stalling collector-facing tasks if not carefully isolated. |
| **Rationale** | Preserves oldest data in queue — opposite UX to Option A. |
| **Implementation impact** | Requires async coordination (notify/wait) between poll loop and send loop; deadlock avoidance. |
| **Test impact** | Stall + resume tests; timeouts. |
| **Operator-visible** | Perceived “freeze” if mis-tuned. |
| **Risk if unfrozen** | Bridge may block F-IPC or appear hung. |

### 6.3 Option C — Replace/coalesce “snapshot” message

| Aspect | Content |
|--------|---------|
| **Description** | Instead of N queued `session_snapshot_replaced`, keep **one** pending “latest replacement” envelope per session/connection. |
| **Recommended?** | **Strong candidate** for **poll-based** live path — duplicate replacements add no information. |
| **Rationale** | Matches “fingerprint changed” idempotence; reduces queue pressure without pretending to be a delta log. |
| **Implementation impact** | De-duplicate or overwrite slot; still need overflow policy for non-coalescible messages. |
| **Test impact** | Fuzz rapid polls; assert at most one pending replace. |
| **Operator-visible** | Fewer WS messages; same HTTP truth. |
| **Risk if unfrozen** | Clients might depend on every poll tick firing — document coalescing. |

### 6.4 Option D — Force `session_resync_required` immediately (no silent drop)

| Aspect | Content |
|--------|---------|
| **Description** | On overflow or suspected gap, **stop** enqueueing; emit `session_resync_required`; client must use HTTP snapshot. |
| **Recommended?** | **Use for correctness-first modes** and when drop semantics are unacceptable. |
| **Rationale** | Explicit loss-of-continuity signal; aligns with “honest recovery” story. |
| **Implementation impact** | Tight coupling between queue monitor and WS writer; clear state machine. |
| **Test impact** | Assert no silent loss without escalation when policy says so. |
| **Operator-visible** | More HTTP load on overload — acceptable if labeled. |
| **Risk if unfrozen** | Silent truncation with no `session_resync_required` — **worst** client bug class. |

**Suggested combination for poll-based v0:** **Option A or C for routine pressure** + **Option D when coalescing cannot bound work** (e.g. non-mergeable events in a future ingest era).

---

## 7. Decision: when to emit `session_resync_required`

### 7.1 Option A — Threshold-based (events and/or bytes)

| Aspect | Content |
|--------|---------|
| **Description** | Emit when **pending** outbound events **or** queued bytes exceed frozen thresholds (AND/OR per policy). |
| **Recommended?** | **Yes** — but only after thresholds are frozen; today’s numbers are placeholders. |
| **Rationale** | Matches spec intent for backlog recovery; testable. |
| **Implementation impact** | Accounting per queue; atomic counters. |
| **Test impact** | Boundary tests at N-1, N, N+1; byte vs event divergence. |
| **Operator-visible** | Tunable overload behavior. |
| **Risk if unfrozen** | Wrong units → OOM (bytes) or premature resync (events only). |

### 7.2 Option B — Failure / gap-based only

| Aspect | Content |
|--------|---------|
| **Description** | Emit on **poll failure**, **auth error**, **IPC disconnect**, **sequence gap** (future ingest), not on queue size. |
| **Recommended?** | **Supplement** Option A — not sufficient alone once real deltas exist. |
| **Rationale** | Separates “overload” from “broken pipe”. |
| **Implementation impact** | Distinct code paths; reason strings must stay disjoint from bounded HTTP. |
| **Test impact** | Inject F-IPC failures; assert `LIVE_WS_REASON_POLL_FAILED`. |
| **Operator-visible** | Clear incident story. |
| **Risk if unfrozen** | Memory DoS if only gap-based without size caps. |

---

## 8. Client inference matrix (must stay consistent after freeze)

| Message | Client may **safely** infer | Client must **not** infer |
|---------|-----------------------------|---------------------------|
| **`session_delta`** (future) | Only what the envelope explicitly states — ordering within that connection after freeze. | Global ordering across connections; durability on disk. |
| **`session_snapshot_replaced`** | Bounded snapshot changed; **replacement** semantics — not append-only history; use HTTP for full view. | That every intermediate state was delivered over WS; that cursor is a live offset. |
| **`session_resync_required`** | Continuity for **live WS path** is abandoned for this escalation class; **must** re-seed from HTTP snapshot (or disconnect). | That HTTP `resync_hint` is present or absent — WS reasons are **not** HTTP tokens. |

**Cross-reference:** HTTP `resync_hint.reason` values remain **`RESYNC_HINT_REASON_*`** only. WebSocket live reasons remain **`LIVE_WS_REASON_*`** — parsers must not alias them.

---

## 9. Continuity vs queue overflow

| Topic | Clarification |
|-------|----------------|
| **Bounded snapshot** | Cursor + `snapshot_origin` rules are **F-04** — unchanged here. |
| **Live WS path** | Overflow or drop policy **breaks** “I saw every live message” unless spec explicitly promises a stronger guarantee later. |
| **Freeze requirement** | Declare whether overflow is **silent** (and thus continuity-lost) vs **always escalated** — **must** match tests and operator docs. |

---

## 10. What remains impossible without stronger transport / runtime

| Limitation | Notes |
|------------|--------|
| **Cross-process backpressure** | Bridge cannot push back on collector without an IPC contract for flow control (F-IPC not frozen for production). |
| **Exactly-once delivery** | TCP/WS without app-level seq + idempotency does not give exactly-once. |
| **Global fairness** | Per-connection queues do not prioritize sessions — product must accept or add scheduler. |
| **Durability** | Queue in RAM is not crash recovery; session log durability is collector/ingest scope. |

---

## 11. Immediate next steps after humans choose

1. Encode chosen thresholds and overflow policy as **named constants** with stable semantics (drop `_provisional` suffix only when behavior matches the freeze).  
2. Implement **real** outbound queue path with metrics (drops, bytes, escalations) — **separate task** from this document.  
3. Extend tests: overflow, coalescing, resync escalation, **no collision** between `LIVE_WS_REASON_*` and `RESYNC_HINT_REASON_*`.  
4. Update `docs/PHASE0_FREEZE_TRACKER.md` to mark F-03 closed with pointers to this doc’s §5–§7 decisions.  
5. **Do not** extend bounded HTTP `resync_hint` tokens for live backlog without F-04 live-era row — prefer WS additive reasons until a versioned plan exists.

---

## 12. Traceability

| Artifact | Role |
|----------|------|
| `glass_bridge::live_session_ws` | WS skeleton + provisional queue |
| `glass_bridge::resync` | Bounded HTTP hints + `PROVISIONAL_BACKLOG_EVENT_THRESHOLD` |
| `docs/contracts/live_session_ws_skeleton_v1.md` | Wire envelope notes |
| `docs/PHASE0_FREEZE_TRACKER.md` | F-03 / F-04 rows |

---

*End of F-03 live backlog freeze proposal (decision-ready package).*

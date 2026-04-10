# F-03 / F-04 freeze proposal (bounded snapshot era)

**Status:** bounded-era **F-04** choices are **closed** in `docs/PHASE0_FREEZE_TRACKER.md` (**Closed — bounded-era F-04**). This document remains the historical rationale and options analysis. Machine-readable subset: `docs/contracts/bridge_session_snapshot_bounded_v0.schema.json`.  
**Scope:** bridge HTTP snapshot + collector F-IPC bounded replies **only**. Live WebSocket deltas, `live_session_ingest: true`, and F-IPC transport freeze are **out of scope** for this document.

---

## 1. What is already implemented (ground truth)

| Area | Reality in repo |
|------|-----------------|
| **HTTP** | `GET /sessions/:id/snapshot?cursor=&max_events=` → `SessionSnapshotResponse` with `snapshot_cursor`, `events`, optional `bounded_snapshot`, optional `resync_hint`, optional `retained_snapshot_unix_ms`, `max_events_requested` when F-IPC used. |
| **F-IPC** | `BoundedSnapshotReply` includes `snapshot_meta: FipcBoundedSnapshotMeta` (origin, counts, truncation flag) when collector sends metadata. |
| **Cursor strings** | `v0:empty` — no session row in collector store **or** per-RPC path returned zero events (see §2). `v0:off:0` — session **known** in store but timeline length zero. `v0:off:N` — prefix of **N** events returned under cap. |
| **Origins** | `unknown_or_empty`, `collector_store`, `per_rpc_procfs`, `per_rpc_file_lane` (`collector/src/ipc.rs` constants). |
| **resync_hint reasons** | `bounded_truncation`, `per_rpc_poll_snapshot_not_incremental`, `retained_snapshot_tail_replaces_not_append_only` (+ optional `detail`). |
| **Tests** | `bridge/tests/snapshot_fipc.rs`, `collector` store paths, truncation, per-RPC, retained. |

---

## 2. snapshot_cursor semantics (proposal)

### 2.1 Freeze the string grammar (v0)

| Cursor | Meaning | Client may infer |
|--------|---------|------------------|
| `v0:empty` | No events in this response **and** collector classifies as **unknown session** (missing store key) **or** per-RPC poll produced an empty full batch. | **Not** a durable “stream position”. Next call may differ entirely (especially per-RPC). |
| `v0:off:0` | Session **exists** in collector store but stored timeline length is **zero**. | Distinct from unknown: same `session_id` was registered, timeline empty. Still not a live offset. |
| `v0:off:N` | At most **N** events returned (prefix), `N ≤ min(requested_cap, available_in_view)`. | `N` is the count returned in **this** response, not an offset into a future delta log. |

**Note:** `v0:empty` currently overloads “unknown store” and “per-RPC empty poll”.  

| Option | Description | Implementation impact | Test impact |
|--------|-------------|----------------------|-------------|
| **A (recommended)** | Keep one literal `v0:empty` for both; require clients to use `bounded_snapshot.snapshot_origin` to disambiguate. | None beyond docs + existing `snapshot_origin`. | Assert origin in tests (already). |
| **B** | Split: e.g. `v0:unknown` vs `v0:empty_poll`. | **Breaking** HTTP/F-IPC string changes; migrate clients. | Large. |
| **Risk if unfrozen** | Clients parse cursor only and mis-classify unknown vs empty poll. | | |

**Recommendation:** **Option A** — freeze cursor **grammar** as above; **require** structured `bounded_snapshot` / `snapshot_origin` for disambiguation.

---

## 3. Opaque string vs structured cursor (proposal)

| Option | Description | Implementation impact | Risk |
|--------|-------------|----------------------|------|
| **A (recommended)** | Keep `snapshot_cursor` as **opaque string** for v0; treat `bounded_snapshot` + `snapshot_meta` as the **normative** bounded contract. | Stable; already shipped. | Low. |
| **B** | Add parallel JSON object `snapshot_cursor_struct: { version, kind, n, ... }`. | Duplicate information; more schema churn. | Medium. |

**Recommendation:** **Option A**; defer structured cursor until live ingest needs real offsets.

---

## 4. resync_hint (F-04) — shape and reasons

### 4.1 Current shape

```json
{
  "reason": "<string>",
  "snapshot_cursor": "<same as response>",
  "detail": "<optional human/debug>"
}
```

### 4.2 Reasons (bounded era)

| Reason | When emitted | Honest claim |
|--------|----------------|--------------|
| `bounded_truncation` | `truncated_by_max_events == true` | More events existed in view than returned. |
| `per_rpc_poll_snapshot_not_incremental` | Origin is per-RPC procfs or file-lane | Each RPC may re-poll; cursor is not a delta continuation token. |
| `retained_snapshot_tail_replaces_not_append_only` | Origin is `collector_store` **and** `retained_snapshot_unix_ms` present | Retained loop replaces bounded tail; not append-only history. |

| Option | Description | Implementation impact | Test impact |
|--------|-------------|----------------------|-------------|
| **A (recommended)** | Freeze **string tokens** as above; add Rust `pub const` aliases (`RESYNC_HINT_REASON_*`) for drift control. | Constants in `glass_bridge::resync`; single source. | Tests assert against const. |
| **B** | Serialize `reason` as enum integer in JSON. | Breaking for any JSON consumer. | High. |

**Recommendation:** **Option A** for v0 freeze; revisit enum/int when live backlog reasons (`ipc_gap`, etc.) land.

### 4.3 `detail` field

| Option | Description |
|--------|-------------|
| **A (recommended)** | Optional, **non-normative**, debugging/operator text; not parsed by production clients. |
| **B** | Machine-parseable key=value — defer until needed. |

**Recommendation:** **Option A**.

---

## 5. Bounded continuity rules (what “loss of continuity” means)

**Glass does not offer live delta continuity today.** The bridge may only signal:

1. **Truncation** — strictly more events existed than returned (`bounded_truncation`).
2. **Per-RPC non-incrementality** — snapshot is from a fresh poll, not `seq+1` after last event (`per_rpc_poll_snapshot_not_incremental`).
3. **Retained tail replacement** — store row is a replaced tail, not append-only log (`retained_snapshot_tail_replaces_not_append_only`).

**When `resync_hint` is absent:** no *additional* bounded-semantics warning beyond cursor + `bounded_snapshot` (e.g. seeded store, single page, no retained timestamp).

| Option | Description |
|--------|-------------|
| **A (recommended)** | Freeze: absence of `resync_hint` means “no extra bounded warning,” **not** “strong eventual consistency.” |
| **B** | Treat absence as “green for replication” — **reject** (over-claim). |

**Recommendation:** **Option A**.

---

## 6. F-03 backlog threshold (unchanged this pass)

`PROVISIONAL_BACKLOG_EVENT_THRESHOLD` remains **human-owned** until live outbound delta queue exists. **Do not** conflate with bounded snapshot hints.

---

## 7. What must remain deferred until live ingest

- Cursor that encodes **byte/seq offset** into a durable stream.
- `resync_hint` reasons: `backlog`, `ipc_gap`, `ws_reconnect`, etc.
- `live_session_ingest: true` and WS delta contract.
- F-IPC transport freeze (Unix socket, peer creds).

---

## 8. Human decisions ready now

1. **Accept Option A** for cursor grammar + `snapshot_origin` disambiguation (§2.1, §3).  
2. **Accept Option A** for `resync_hint` string tokens + Rust consts (§4.2).  
3. **Accept Option A** for optional `detail` non-normative (§4.3).  
4. **Accept Option A** for meaning of absent `resync_hint` (§5).  
5. **Explicitly defer** F-03 numeric backlog / byte ceiling until live queue design.

---

## 9. After freeze — recommended implementation order

1. Record closed decisions in `PHASE0_FREEZE_TRACKER.md` (F-03/F-04 sections).  
2. Add JSON Schema or OpenAPI fragment for `SessionSnapshotResponse` (bounded era).  
3. Viewer: read `bounded_snapshot` + `resync_hint` for static replay / operator messaging only.  
4. When live ingest starts: extend `resync_hint` **additively** with new reason tokens; do not break bounded tokens.

---

## 10. References

- Code: `glass_bridge::snapshot_contract`, `glass_bridge::resync`, `glass_bridge::http_types`, `glass_collector::ipc`, `glass_collector::ipc_dev_tcp`.  
- Tracker: `docs/PHASE0_FREEZE_TRACKER.md`.  
- Tests: `bridge/tests/snapshot_fipc.rs`, `collector` `SnapshotStore` / F-IPC tests.

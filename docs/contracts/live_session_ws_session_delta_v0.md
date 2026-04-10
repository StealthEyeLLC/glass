# Live WebSocket `session_delta` v0 (additive)

**Status:** v0 — **not** durable ingest, **not** bounded HTTP F-04.  
**Authority:** `GLASS_FULL_ENGINEERING_SPEC_v10.md`, `GLASS_V0_BUILD_PLAN.md`. F-03 queue policy: `glass_bridge::live_session_ws`.

## When `session_delta` is allowed

1. Bridge: `session_delta_wire_v0` is on — `BridgeConfig.session_delta_wire_v0` **or** env `GLASS_BRIDGE_SESSION_DELTA_WIRE_V0=1` (process startup; OR semantics with config).
2. Collector F-IPC is configured (same as live-session skeleton).
3. Client sends `live_session_subscribe` with **`"session_delta_wire": true`**.
4. **Fingerprint:** a successful F-IPC poll observes the **same bounded snapshot fingerprint** as the previous successful poll for this subscription (replacement-class prefix unchanged).
5. **Events:** `session_delta` is **emitted only when** `events` is **non-empty** — populated from **`collector_store`** **append-only** tails carried in F-IPC (`BoundedSnapshotReply.live_delta_events`) while **`store_revision`** matches the bridge watermark (see below). If there is nothing new since the watermark, **no** `session_delta` frame is sent (no empty liveness spam).

## When `session_delta` is **not** sent (fallbacks)

- Fingerprint **changed** since last poll → **`session_snapshot_replaced`** only (bounded replacement / update).
- **`live_delta_tail_v0`** continuity **withheld** (`store_revision` mismatch vs client watermark) → **`session_snapshot_replaced`** + **`session_resync_required`** with `LIVE_WS_REASON_STORE_REPLACED_SINCE_WATERMARK` (additive WS-only reason; **not** a frozen HTTP `resync_hint.reason` token).
- Poll failure → **`session_resync_required`** + warning (existing path).
- Continuity / fingerprint gap hooks → **`session_resync_required`** (F-03).
- Server or client did not opt in to delta wire.
- Snapshot origin is **not** `collector_store` (per-RPC procfs / file-lane): tail fields are **unsupported** — bridge does not claim append-only deltas; use **`session_snapshot_replaced`** when the fingerprint changes.

## F-IPC (provisional) — honest append-only tail

- **`BoundedSnapshotRequest`**: optional **`live_delta_tail_v0`** — `{ after_available_exclusive, base_store_revision }` (must match the client’s last acknowledged `available_in_view` and `snapshot_meta.store_revision` from a prior reply).
- **`BoundedSnapshotReply`**: optional **`live_delta_events`** + **`live_delta_continuity_v0`**; **`FipcBoundedSnapshotMeta.store_revision`** is set for **`collector_store`** (increments on **`set_session_events`** replacement; **stable** on **`append_session_events`** and on **prefix-extending** retained polls — see below).
- **Caps:** `PROVISIONAL_FIPC_MAX_DELTA_EVENTS` (collector) bounds tail size per reply. Bounded HTTP F-04 remains **unchanged**.

## Retained procfs / file-lane loops (`ipc-serve`)

Background **`--procfs-retained-session`** / **`--file-lane-retained-session`** ticks call **`SnapshotStore::apply_retained_poll_continuity`**: when the **full** normalized poll vector **extends** the previous store as an exact prefix (same leading JSON values), the store is updated **without** bumping **`store_revision`** (trimmed to the last `max_retained` events). When the poll is **not** a prefix extension (reordered window, disjoint fixture, empty→non-empty reset, etc.), the store is **replaced** and **`store_revision`** increments — the bridge may then emit **`session_resync_required`** if a live client had a stale tail watermark.

## Envelope (minimal)

- `type`: `glass.bridge.live_session.v1`
- `msg`: `session_delta`
- `protocol`: `1`
- `session_id`, `session_delta_wire`: `"v0"`
- `ws_seq`: monotonic `u64` per subscribed connection (each emitted delta).
- `snapshot_cursor`: opaque echo from the current bounded poll (same string family as HTTP; **not** a live log offset).
- `continuity`: `poll_tick_unchanged_bounded_fingerprint`
- `events`: JSON array — **normalized** append-only tail events when continuity is provable; **omitted from wire when empty** (no frame) in the current bridge implementation.
- `honesty`: human-readable non-claim.

## Client contract

- **`session_delta`** means: same bounded fingerprint as the prior poll **and** (when non-empty) append-only **`collector_store`** tails **only** — **not** a global durable log or guaranteed delivery.
- Use **`session_snapshot_replaced`** for replacement semantics; use **`session_resync_required`** when continuity is explicitly lost (F-03 or store revision mismatch).

## Capability JSON

- `GET /capabilities`: `websocket.session_delta_wire_v0`, `live_session_ingest` (true only when delta wire is enabled **and** F-IPC configured).
- WS hello: `session_delta_wire_v0_server` when bridge allows negotiation.

## Provisional / next

- **F-IPC transport** remains **provisional** (dev TCP); not frozen.
- Prefix detection is **value-equality** on normalized JSON in order — not a cryptographic or causal guarantee across arbitrary host polls.
- **Durable** push ingest, multi-subscriber history, and non-`collector_store` incremental semantics remain **out of scope** for this v0 path.

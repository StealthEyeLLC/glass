# Live WebSocket `session_delta` v0 (additive)

**Status:** v0 wire skeleton — **not** durable ingest, **not** bounded HTTP F-04.  
**Authority:** `GLASS_FULL_ENGINEERING_SPEC_v10.md`, `GLASS_V0_BUILD_PLAN.md`. F-03 queue policy: `glass_bridge::live_session_ws`.

## When `session_delta` is allowed

1. Bridge: `session_delta_wire_v0` is on — `BridgeConfig.session_delta_wire_v0` **or** env `GLASS_BRIDGE_SESSION_DELTA_WIRE_V0=1` (process startup; OR semantics with config).
2. Collector F-IPC is configured (same as live-session skeleton).
3. Client sends `live_session_subscribe` with **`"session_delta_wire": true`**.
4. **Honesty:** `session_delta` is emitted **only** when a successful F-IPC poll observes the **same bounded snapshot fingerprint** as the previous successful poll for this subscription (replacement-class state unchanged).

## When `session_delta` is **not** sent

- Fingerprint **changed** since last poll → use **`session_snapshot_replaced`** only (bounded replacement / update).
- Poll failure → **`session_resync_required`** + warning (existing path).
- Continuity / fingerprint gap hooks → **`session_resync_required`** (F-03).
- Server or client did not opt in to delta wire.

## Envelope (minimal)

- `type`: `glass.bridge.live_session.v1`
- `msg`: `session_delta`
- `protocol`: `1`
- `session_id`, `session_delta_wire`: `"v0"`
- `ws_seq`: monotonic `u64` per subscribed connection (each emitted delta).
- `snapshot_cursor`: opaque echo from the current bounded poll (same string family as HTTP; **not** a live log offset).
- `continuity`: `poll_tick_unchanged_bounded_fingerprint`
- `events`: JSON array — v0 polling path uses **`[]`** (no append-only event stream from collector push).
- `honesty`: human-readable non-claim.

## Client contract

- **`session_delta`** here means: “same fingerprint as last poll; empty events in v0.” It does **not** imply append-only history or that collector retained store is a durable log.
- Use **`session_snapshot_replaced`** for replacement semantics; use **`session_resync_required`** when continuity is explicitly lost (F-03).

## Capability JSON

- `GET /capabilities`: `websocket.session_delta_wire_v0`, `live_session_ingest` (true only when delta wire is enabled **and** F-IPC configured).
- WS hello: `session_delta_wire_v0_server` when bridge allows negotiation.

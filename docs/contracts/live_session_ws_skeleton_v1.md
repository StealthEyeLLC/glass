# Live-session WebSocket skeleton (v1, provisional)

**Status:** first implementation pass — **not** final live mode, **not** F-03 backlog freeze, **not** F-IPC transport freeze.

**Does not modify** bounded-era F-04 HTTP snapshot semantics (`docs/contracts/bridge_session_snapshot_bounded_v0.schema.json`, `RESYNC_HINT_REASON_*`).

## Transport

- `GET /ws` with existing bridge auth (`Authorization: Bearer` or `?access_token=` on loopback).

## Hello (`glass.bridge.ws.hello`)

- `live_session_delta_skeleton`: `true` only when collector F-IPC is configured on the bridge.
- `live_session_protocol`: `1` when present.
- `live_delta_stream` remains **`false`** (honest — not a production delta pipeline).

## Subscribe (client → server)

```json
{ "msg": "live_session_subscribe", "session_id": "<id>", "protocol": 1 }
```

## Server messages (`glass.bridge.live_session.v1`)

| `msg` | Purpose |
|-------|---------|
| `session_hello` | Ack after baseline F-IPC poll; states bounded / non-durable continuity. |
| `session_snapshot_replaced` | Bounded view changed vs prior poll; includes opaque `snapshot_cursor`, `snapshot_origin`, optional `retained_snapshot_unix_ms`, truncated `events_sample`. |
| `session_resync_required` | Live-era overload / queue drop — **`reason`** uses `LIVE_WS_REASON_*` (**not** HTTP `RESYNC_HINT_REASON_*`). |
| `session_warning` | e.g. F-IPC poll failure (provisional). |

## Implementation constants (Rust)

- `glass_bridge::live_session_ws::PROVISIONAL_LIVE_WS_POLL_INTERVAL_MS` (override: env `GLASS_BRIDGE_LIVE_WS_POLL_MS`, clamped 10–60000).
- `PROVISIONAL_LIVE_WS_OUTBOUND_QUEUE_MAX`
- `LIVE_WS_REASON_*` — WebSocket-only, additive.

## Next steps (human / product)

- F-03 live backlog policy when a real outbound queue exists.
- F-04 live-era `resync_hint` extensions (additive JSON).
- Push or shared-memory path instead of bridge polling (optional).

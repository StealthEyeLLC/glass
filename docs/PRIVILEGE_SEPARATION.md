# Privilege separation

**Spec:** §10.3B, §18.4, §30.2A.

## Target architecture

1. **Privileged collector process** — may attach eBPF / high-fidelity sensors (Phase 2+). **Does not** serve the browser.
2. **Unprivileged bridge process** — loopback HTTP/WebSocket to the browser; **never** inherits collector capabilities.
3. **Authenticated local IPC** between the two; the browser talks only to the bridge.

## What is implemented now (Phase 2 groundwork)

| Piece | Location | Status |
|--------|----------|--------|
| Privilege / role types | `glass_collector::privilege` (`PrivilegeMode`, `CollectorProcessRole`, `PrivilegeContext`) | **Real types** — runtime probe still “not implemented” |
| IPC contract (JSON-serializable) | `glass_collector::ipc` (`CollectorIpcMessage`, `IpcPayload`, `IpcAuthHandshake`, `validate_ipc_auth_version`) | **Skeleton** — no socket, no crypto |
| Auth version constant | `PROVISIONAL_IPC_AUTH_TOKEN_VERSION` (`0`) | **Provisional** — see `docs/PHASE0_FREEZE_TRACKER.md` |
| Bridge crate | `glass_bridge` | **Loopback HTTP + WebSocket skeleton** (`glass_bridge` binary): `/health`, `/capabilities`, `/sessions/:id/snapshot`, `/ws` — **no** embedded collector, **no** live ingest, **no** privileged syscalls; bearer token at startup (`GLASS_BRIDGE_TOKEN` / `--token`). Browser WS may use `?access_token=` on loopback (provisional; see crate rustdoc). |

## Collector vs bridge boundary

- **`glass-collector`** may run with **`capabilities`** to print JSON `FidelityReport` (stdout). **`run`** (default) still exits `2` with **no telemetry**.
- **No** browser-facing code in the collector crate.
- **No** live transport: IPC types are for future wiring only.

## Open / human-owned

- IPC credential format, socket path, and challenge/response semantics remain **open** until explicitly frozen (tracker + program).
- Real **privilege detection** (CAP_BPF, root) is deferred — today `PrivilegeContext::effective_capability_summary` is an honest placeholder string.

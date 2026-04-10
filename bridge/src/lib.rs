//! Unprivileged local **bridge** (spec §18 / §18A, build plan Phase 5).
//!
//! ## Role
//!
//! - **Loopback HTTP + WebSocket skeleton** for the operator viewer. **No** privileged collection
//!   inside this process — optional **F-IPC** talks to a separate `glass-collector ipc-serve`
//!   process over **provisional TCP loopback** for **bounded snapshots** only (`docs/PRIVILEGE_SEPARATION.md`).
//! - **Honest scope:** structural routes, auth scaffolding, bounded snapshot JSON shape (F-04 frozen on
//!   HTTP), optional **live-session WebSocket** (`live_session_ws`) that **polls** F-IPC when configured —
//!   bounded **replacement** + optional **`session_delta`** v0 (same-fingerprint poll ticks), not push ingest.
//!
//! ## Auth
//!
//! - HTTP JSON routes require `Authorization: Bearer <token>` (same value as `GLASS_BRIDGE_TOKEN` /
//!   `--token` at startup).
//! - Browser `WebSocket` cannot always set `Authorization`; on **loopback** the server also accepts
//!   `GET /ws?access_token=<token>` as a **provisional** escape hatch (documented; replace when F-IPC
//!   + wire format freeze).
//! - F-IPC uses a **separate** shared secret (`--collector-ipc-secret`), not the HTTP bearer.

pub mod http_types;
pub mod ipc_client;
pub use ipc_client::PROVISIONAL_FIPC_CONNECT_ATTEMPT_MAX;
pub mod live_session_ws;
pub mod resync;
mod server;
mod snapshot_contract;

pub use server::{app_router, serve, serve_listener, ServeError};

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;

/// Shared router state (HTTP bearer; WebSocket auth; optional F-IPC).
#[derive(Clone)]
pub struct AppState {
    pub bearer_token: Arc<str>,
    pub collector_ipc: Option<CollectorIpcClientConfig>,
    /// `GLASS_BRIDGE_SESSION_DELTA_WIRE_V0=1` at process start — allows opt-in `session_delta` on WS when
    /// combined with client `live_session_subscribe.session_delta_wire: true` and F-IPC polling honesty rules.
    pub session_delta_wire_v0: bool,
}

/// Configuration for bridge → collector F-IPC client (provisional TCP).
#[derive(Debug, Clone)]
pub struct CollectorIpcClientConfig {
    pub addr: SocketAddr,
    pub shared_secret: Arc<str>,
    pub timeout: Duration,
}

/// Runtime configuration for [`serve`] and [`app_router`].
#[derive(Debug, Clone)]
pub struct BridgeConfig {
    pub bind: SocketAddr,
    pub bearer_token: Arc<str>,
    /// When false (default), refuse to bind non-loopback addresses.
    pub allow_non_loopback: bool,
    /// When set, `GET /sessions/:id/snapshot` uses collector F-IPC; on failure returns HTTP 503.
    pub collector_ipc: Option<CollectorIpcClientConfig>,
    /// Enables `session_delta` v0 wire (OR with `GLASS_BRIDGE_SESSION_DELTA_WIRE_V0`); tests set explicitly.
    pub session_delta_wire_v0: bool,
}

/// Configuration validation error (e.g. non-loopback bind without opt-in).
#[derive(Debug, Error, PartialEq, Eq)]
pub enum BridgeConfigError {
    #[error("bind address must be loopback unless allow_non_loopback is set (privilege / exposure boundary)")]
    LoopbackOnly,
    #[error("collector F-IPC endpoint must be loopback for provisional transport")]
    CollectorIpcLoopbackOnly,
}

impl BridgeConfig {
    pub fn validate(&self) -> Result<(), BridgeConfigError> {
        if !self.allow_non_loopback && !self.bind.ip().is_loopback() {
            return Err(BridgeConfigError::LoopbackOnly);
        }
        if let Some(ref ipc) = self.collector_ipc {
            if !ipc.addr.ip().is_loopback() {
                return Err(BridgeConfigError::CollectorIpcLoopbackOnly);
            }
        }
        Ok(())
    }
}

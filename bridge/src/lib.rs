//! Unprivileged local **bridge** (spec §18 / §18A, build plan Phase 5).
//!
//! ## Role
//!
//! - **Loopback HTTP + WebSocket skeleton** for the operator viewer. **No** privileged collection
//!   and **no** embedded collector logic — IPC to a separate collector process remains future work
//!   (`docs/PRIVILEGE_SEPARATION.md`, F-IPC).
//! - **Honest scope:** structural routes, auth scaffolding, bounded snapshot JSON shape, and a
//!   WebSocket **handshake only** (no fabricated live event stream).
//!
//! ## Auth
//!
//! - HTTP JSON routes require `Authorization: Bearer <token>` (same value as `GLASS_BRIDGE_TOKEN` /
//!   `--token` at startup).
//! - Browser `WebSocket` cannot always set `Authorization`; on **loopback** the server also accepts
//!   `GET /ws?access_token=<token>` as a **provisional** escape hatch (documented; replace when F-IPC
//!   + wire format freeze).

pub mod http_types;
pub mod resync;
mod server;

pub use server::{app_router, serve, serve_listener, ServeError};

use std::net::SocketAddr;
use std::sync::Arc;
use thiserror::Error;

/// Runtime configuration for [`serve`] and [`app_router`].
#[derive(Debug, Clone)]
pub struct BridgeConfig {
    pub bind: SocketAddr,
    pub bearer_token: Arc<str>,
    /// When false (default), refuse to bind non-loopback addresses.
    pub allow_non_loopback: bool,
}

/// Configuration validation error (e.g. non-loopback bind without opt-in).
#[derive(Debug, Error, PartialEq, Eq)]
pub enum BridgeConfigError {
    #[error("bind address must be loopback unless allow_non_loopback is set (privilege / exposure boundary)")]
    LoopbackOnly,
}

impl BridgeConfig {
    pub fn validate(&self) -> Result<(), BridgeConfigError> {
        if !self.allow_non_loopback && !self.bind.ip().is_loopback() {
            return Err(BridgeConfigError::LoopbackOnly);
        }
        Ok(())
    }
}

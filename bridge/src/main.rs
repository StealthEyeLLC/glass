//! Local bridge process — loopback HTTP/WebSocket skeleton (Phase 5).
//!
//! Does **not** start the collector or serve live telemetry. See `glass_bridge` crate docs.

use std::net::SocketAddr;
use std::sync::Arc;

use clap::Parser;
use glass_bridge::{serve, BridgeConfig};

#[derive(Parser, Debug)]
#[command(name = "glass_bridge")]
#[command(about = "Glass local bridge: loopback HTTP/WebSocket skeleton (no live ingest)")]
struct Cli {
    /// Listen address (default loopback). Non-loopback requires `GLASS_BRIDGE_ALLOW_NON_LOOPBACK=1`.
    #[arg(long, default_value = "127.0.0.1:9781", env = "GLASS_BRIDGE_LISTEN")]
    listen: String,

    /// Bearer token for HTTP `Authorization` and WebSocket auth (required).
    #[arg(long, env = "GLASS_BRIDGE_TOKEN")]
    token: String,

    /// Allow binding a non-loopback address (off by default).
    #[arg(long, default_value_t = false, env = "GLASS_BRIDGE_ALLOW_NON_LOOPBACK")]
    allow_non_loopback: bool,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    let bind: SocketAddr = cli.listen.parse()?;
    let config = BridgeConfig {
        bind,
        bearer_token: Arc::from(cli.token.into_boxed_str()),
        allow_non_loopback: cli.allow_non_loopback,
    };
    serve(config).await?;
    Ok(())
}

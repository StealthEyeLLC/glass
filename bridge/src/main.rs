//! Local bridge process — loopback HTTP/WebSocket skeleton (Phase 5).
//!
//! Optional F-IPC to `glass-collector ipc-serve` for bounded snapshots. See `glass_bridge` crate docs.

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use clap::Parser;
use glass_bridge::{serve, BridgeConfig, CollectorIpcClientConfig};

#[derive(Parser, Debug)]
#[command(name = "glass_bridge")]
#[command(
    about = "Glass local bridge: loopback HTTP/WebSocket + optional collector F-IPC (bounded snapshots)"
)]
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

    /// `glass-collector ipc-serve` socket address (loopback only). Requires `--collector-ipc-secret`.
    #[arg(long, env = "GLASS_BRIDGE_COLLECTOR_IPC_ENDPOINT")]
    collector_ipc_endpoint: Option<String>,

    /// Shared secret for F-IPC (pair with collector `ipc-serve --shared-secret`).
    #[arg(long, env = "GLASS_BRIDGE_COLLECTOR_IPC_SECRET")]
    collector_ipc_secret: Option<String>,

    /// Per-RPC timeout (seconds) for F-IPC snapshot fetch.
    #[arg(
        long,
        default_value_t = 2,
        env = "GLASS_BRIDGE_COLLECTOR_IPC_TIMEOUT_SECS"
    )]
    collector_ipc_timeout_secs: u64,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    let bind: SocketAddr = cli.listen.parse()?;
    let collector_ipc = match (
        cli.collector_ipc_endpoint.as_ref(),
        cli.collector_ipc_secret.as_ref(),
    ) {
        (None, None) => None,
        (Some(ep), Some(sec)) => {
            let addr: SocketAddr = ep.parse()?;
            if !addr.ip().is_loopback() {
                return Err(
                    "collector-ipc-endpoint must be loopback (provisional F-IPC transport)".into(),
                );
            }
            Some(CollectorIpcClientConfig {
                addr,
                shared_secret: Arc::from(sec.clone().into_boxed_str()),
                timeout: Duration::from_secs(cli.collector_ipc_timeout_secs.max(1)),
            })
        }
        _ => {
            return Err(
                "set both --collector-ipc-endpoint and --collector-ipc-secret, or neither".into(),
            );
        }
    };
    let config = BridgeConfig {
        bind,
        bearer_token: Arc::from(cli.token.into_boxed_str()),
        allow_non_loopback: cli.allow_non_loopback,
        collector_ipc,
    };
    serve(config).await?;
    Ok(())
}

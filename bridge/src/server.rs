//! Axum router and [`serve`] entrypoint.

use axum::extract::ws::WebSocketUpgrade;
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use glass_collector::ipc::{
    FipcCollectorToBridge, PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS,
    PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
};
use serde::Deserialize;
use serde_json::json;

use crate::http_types::{
    CapabilitiesResponse, CollectorIpcSnapshotMeta, HealthResponse, SessionSnapshotResponse,
    SNAPSHOT_CURSOR_EMPTY,
};
use crate::ipc_client;
use crate::live_session_ws;
use crate::snapshot_contract;
use crate::{AppState, BridgeConfig, BridgeConfigError};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ServeError {
    #[error(transparent)]
    Config(#[from] BridgeConfigError),
    #[error("IO: {0}")]
    Io(#[from] std::io::Error),
}

/// Build the application router (for tests and [`serve`]).
pub fn app_router(config: &BridgeConfig) -> Router {
    let state = AppState {
        bearer_token: config.bearer_token.clone(),
        collector_ipc: config.collector_ipc.clone(),
        session_delta_wire_v0: config.session_delta_wire_v0
            || crate::live_session_ws::session_delta_wire_v0_enabled_from_env(),
    };

    let protected = Router::new()
        .route("/capabilities", get(capabilities))
        .route("/sessions/{session_id}/snapshot", get(session_snapshot))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            require_bearer_http_middleware,
        ));

    Router::new()
        .route("/health", get(health))
        .merge(protected)
        .route("/ws", get(ws_upgrade))
        .with_state(state)
}

/// Bind per [`BridgeConfig`] and run until Ctrl+C.
pub async fn serve(config: BridgeConfig) -> Result<(), ServeError> {
    config.validate()?;
    let listener = tokio::net::TcpListener::bind(config.bind).await?;
    serve_listener(listener, &config).await
}

/// Run on an existing `TcpListener` (e.g. ephemeral `127.0.0.1:0` in tests).
pub async fn serve_listener(
    listener: tokio::net::TcpListener,
    config: &BridgeConfig,
) -> Result<(), ServeError> {
    config.validate()?;
    let app = app_router(config);
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    Ok(())
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "glass_bridge",
    })
}

async fn capabilities(State(state): State<AppState>) -> Json<CapabilitiesResponse> {
    Json(CapabilitiesResponse::for_bridge_state(
        state.collector_ipc.is_some(),
        PROVISIONAL_FIPC_WIRE_PROTOCOL_VERSION,
        state.session_delta_wire_v0,
    ))
}

#[derive(Debug, Deserialize)]
pub struct SnapshotQuery {
    pub cursor: Option<String>,
    /// Upper bound forwarded to F-IPC `BoundedSnapshotRequest.max_events` (default 64; clamped to collector cap).
    pub max_events: Option<u32>,
}

async fn session_snapshot(
    Path(session_id): Path<String>,
    Query(query): Query<SnapshotQuery>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    let cursor_requested = query.cursor.clone();
    match &state.collector_ipc {
        None => Json(SessionSnapshotResponse {
            session_id,
            cursor_requested,
            snapshot_cursor: SNAPSHOT_CURSOR_EMPTY.to_string(),
            events: Vec::new(),
            live_session_ingest: false,
            resync_hint: None,
            collector_ipc: None,
            retained_snapshot_unix_ms: None,
            bounded_snapshot: None,
            max_events_requested: None,
        })
        .into_response(),
        Some(cfg) => {
            let max_events_req = query
                .max_events
                .unwrap_or(64)
                .max(1)
                .min(PROVISIONAL_FIPC_MAX_SNAPSHOT_EVENTS as u32);
            match ipc_client::fetch_bounded_snapshot(
                cfg.addr,
                cfg.shared_secret.as_ref(),
                &session_id,
                query.cursor.as_deref(),
                max_events_req,
                cfg.timeout,
            )
            .await
            {
                Ok(FipcCollectorToBridge::BoundedSnapshotReply {
                    session_id: sid,
                    snapshot_cursor,
                    events,
                    live_session_ingest,
                    retained_snapshot_unix_ms,
                    snapshot_meta,
                }) => {
                    let (bounded_snapshot, resync_hint) = match snapshot_meta.as_ref() {
                        Some(m) => {
                            let (b, h) = snapshot_contract::bounded_http_from_fipc_meta(
                                m,
                                &snapshot_cursor,
                                retained_snapshot_unix_ms,
                            );
                            (Some(b), h)
                        }
                        None => (None, None),
                    };
                    Json(SessionSnapshotResponse {
                        session_id: sid,
                        cursor_requested,
                        snapshot_cursor,
                        events,
                        live_session_ingest,
                        resync_hint,
                        collector_ipc: Some(CollectorIpcSnapshotMeta {
                            transport: "provisional_tcp_loopback",
                            status: "ok",
                            detail: None,
                        }),
                        retained_snapshot_unix_ms,
                        bounded_snapshot,
                        max_events_requested: Some(max_events_req),
                    })
                    .into_response()
                }
                Ok(other) => (
                    StatusCode::SERVICE_UNAVAILABLE,
                    Json(json!({
                        "error": "collector_ipc_unavailable",
                        "detail": format!("unexpected F-IPC reply: {other:?}"),
                    })),
                )
                    .into_response(),
                Err(e) => (
                    StatusCode::SERVICE_UNAVAILABLE,
                    Json(json!({
                        "error": "collector_ipc_unavailable",
                        "detail": e.to_string(),
                    })),
                )
                    .into_response(),
            }
        }
    }
}

fn bearer_from_header(headers: &HeaderMap) -> Option<&str> {
    let value = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let rest = value.strip_prefix("Bearer ")?;
    Some(rest.trim())
}

async fn require_bearer_http_middleware(
    State(state): State<AppState>,
    headers: HeaderMap,
    request: axum::http::Request<axum::body::Body>,
    next: Next,
) -> Response {
    match bearer_from_header(&headers) {
        Some(t) if t == state.bearer_token.as_ref() => next.run(request).await,
        _ => (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "unauthorized",
                "detail": "Authorization: Bearer <token> required (same as bridge startup token)"
            })),
        )
            .into_response(),
    }
}

#[derive(Debug, Deserialize)]
pub struct WsQuery {
    pub access_token: Option<String>,
}

async fn ws_upgrade(
    ws: WebSocketUpgrade,
    Query(query): Query<WsQuery>,
    headers: HeaderMap,
    State(state): State<AppState>,
) -> Response {
    let ok = match bearer_from_header(&headers) {
        Some(t) if t == state.bearer_token.as_ref() => true,
        _ => query
            .access_token
            .as_deref()
            .is_some_and(|t| t == state.bearer_token.as_ref()),
    };
    if !ok {
        return (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "unauthorized",
                "detail": "WebSocket: use Authorization: Bearer or ?access_token= (loopback-only provisional; see glass_bridge crate docs)"
            })),
        )
            .into_response();
    }
    ws.on_upgrade(move |socket| {
        let st = state.clone();
        async move { live_session_ws::run_ws_session(socket, st).await }
    })
}

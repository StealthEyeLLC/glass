//! Axum router and [`serve`] entrypoint.

use std::sync::Arc;

use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use serde::Deserialize;
use serde_json::json;

use crate::http_types::{
    CapabilitiesResponse, HealthResponse, SessionSnapshotResponse, SNAPSHOT_CURSOR_EMPTY,
};
use crate::resync::PROVISIONAL_BACKLOG_EVENT_THRESHOLD;
use crate::{BridgeConfig, BridgeConfigError};
use thiserror::Error;

/// Shared router state (bearer token for HTTP; WS may use query on loopback).
#[derive(Clone)]
pub struct AppState {
    pub bearer_token: Arc<str>,
}

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

async fn capabilities(State(_state): State<AppState>) -> Json<CapabilitiesResponse> {
    Json(CapabilitiesResponse::skeleton())
}

#[derive(Debug, Deserialize)]
pub struct SnapshotQuery {
    pub cursor: Option<String>,
}

async fn session_snapshot(
    Path(session_id): Path<String>,
    Query(query): Query<SnapshotQuery>,
    State(_state): State<AppState>,
) -> Json<SessionSnapshotResponse> {
    Json(SessionSnapshotResponse {
        session_id,
        cursor_requested: query.cursor.clone(),
        snapshot_cursor: SNAPSHOT_CURSOR_EMPTY.to_string(),
        events: Vec::new(),
        live_session_ingest: false,
        resync_hint: None,
    })
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
    ws.on_upgrade(ws_hello_only)
}

async fn ws_hello_only(mut socket: WebSocket) {
    let hello = json!({
        "type": "glass.bridge.ws.hello",
        "bridge_api_version": 1,
        "live_delta_stream": false,
        "provisional_backlog_event_threshold": PROVISIONAL_BACKLOG_EVENT_THRESHOLD,
        "recovery_strategy": "snapshot_and_cursor",
        "note": "skeleton: no fabricated events; use GET /sessions/:id/snapshot for bounded state"
    });
    if socket
        .send(Message::Text(hello.to_string().into()))
        .await
        .is_err()
    {
        return;
    }
    while let Some(msg) = socket.recv().await {
        if msg.is_err() {
            break;
        }
    }
}

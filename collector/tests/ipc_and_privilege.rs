use glass_collector::{
    build_fidelity_report, default_adapter_stack, validate_ipc_auth_version, CollectorIpcError,
    CollectorIpcMessage, IpcAuthHandshake, PrivilegeContext, PrivilegeMode,
    PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
};

#[test]
fn ipc_auth_version_zero_ok() {
    validate_ipc_auth_version(PROVISIONAL_IPC_AUTH_TOKEN_VERSION).unwrap();
}

#[test]
fn ipc_auth_version_rejects_unknown() {
    let r = validate_ipc_auth_version(99);
    assert!(matches!(r, Err(CollectorIpcError { .. })));
}

#[test]
fn ipc_envelope_round_trip_json() {
    let report = build_fidelity_report(PrivilegeMode::Unprivileged, &default_adapter_stack());
    let msg = CollectorIpcMessage::fidelity(report);
    let j = serde_json::to_string(&msg).unwrap();
    let back: CollectorIpcMessage = serde_json::from_str(&j).unwrap();
    assert_eq!(back.auth_token_version, PROVISIONAL_IPC_AUTH_TOKEN_VERSION);
}

#[test]
fn handshake_serializes() {
    let h = IpcAuthHandshake {
        token_version: PROVISIONAL_IPC_AUTH_TOKEN_VERSION,
        challenge_nonce_hex: "00ff".to_string(),
    };
    serde_json::to_string(&h).unwrap();
}

#[test]
fn privilege_context_default_unprivileged_sensor() {
    let c = PrivilegeContext::default();
    assert_eq!(c.mode, PrivilegeMode::Unprivileged);
}

#[test]
fn privilege_context_for_fidelity_labels() {
    let p = PrivilegeContext::for_fidelity(PrivilegeMode::Privileged);
    assert!(p.effective_capability_summary.contains("privileged"));
}

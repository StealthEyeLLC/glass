use session_engine::SessionManifest;

#[test]
fn manifest_json_roundtrip_preserves_optional_fields() {
    let mut m = SessionManifest::scaffold_new("ses_rt");
    m.fidelity_tier = Some("Full eBPF".to_string());
    m.zone_hydration_performed = Some(true);
    m.user_path_masked_or_hashed = Some(true);
    m.argv_values_stripped_on_export = Some(true);
    m.private_network_endpoints_masked = Some(true);
    let json = serde_json::to_string_pretty(&m).unwrap();
    let m2: SessionManifest = serde_json::from_str(&json).unwrap();
    assert_eq!(m, m2);
    assert_eq!(m2.zone_hydration_performed, Some(true));
}

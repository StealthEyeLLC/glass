use glass_collector::capability::AdapterId;
use glass_collector::{
    build_fidelity_report, default_adapter_stack, default_fidelity_report, FidelityMode,
    PrivilegeMode, RawObservation, RawObservationKind, RawSourceQuality,
};

#[test]
fn raw_observation_serializes_round_trip() {
    let o = RawObservation::new(
        1,
        "ses_t",
        42,
        RawObservationKind::ProcessLifecycle,
        RawSourceQuality::ProcfsDerived,
        AdapterId::ProcfsProcess,
        serde_json::json!({ "pid": 1234, "comm": "test" }),
    );
    let j = serde_json::to_string(&o).unwrap();
    let o2: RawObservation = serde_json::from_str(&j).unwrap();
    assert_eq!(o, o2);
}

#[test]
fn raw_process_sample_kind_round_trips_json() {
    let o = RawObservation::new(
        1,
        "s",
        0,
        RawObservationKind::ProcessSample,
        RawSourceQuality::ProcfsDerived,
        AdapterId::ProcfsProcess,
        serde_json::json!({"semantics":"procfs_poll_snapshot","pid":1}),
    );
    let v: RawObservation = serde_json::from_str(&serde_json::to_string(&o).unwrap()).unwrap();
    assert_eq!(v.kind, RawObservationKind::ProcessSample);
}

#[test]
fn default_fidelity_matches_platform() {
    let r = default_fidelity_report();
    assert_eq!(r.privilege_mode, PrivilegeMode::Unprivileged);
    assert!(!r.summary_for_operator.is_empty());
    assert_eq!(r.adapters.len(), 4);

    #[cfg(target_os = "linux")]
    {
        assert_eq!(r.mode, FidelityMode::FallbackReducedVisibility);
        let proc = r
            .adapters
            .iter()
            .find(|m| m.adapter_id == AdapterId::ProcfsProcess)
            .unwrap();
        assert!(proc.implementation_active);
        assert!(r.summary_for_operator.contains("procfs"));
        assert!(r
            .missing_event_classes
            .iter()
            .any(|s| s == "atomic_kernel_process_spawn_exit_truth"));
    }
    #[cfg(not(target_os = "linux"))]
    {
        assert_eq!(r.mode, FidelityMode::NoSensorsActive);
        assert!(r.adapters.iter().all(|m| !m.implementation_active));
    }
}

#[test]
fn privileged_without_ebpf_never_high_fidelity_primary() {
    let adapters = default_adapter_stack();
    let r = build_fidelity_report(PrivilegeMode::Privileged, &adapters);
    assert_ne!(r.mode, FidelityMode::HighFidelityPrimary);
    #[cfg(target_os = "linux")]
    assert_eq!(r.mode, FidelityMode::FallbackReducedVisibility);
    #[cfg(not(target_os = "linux"))]
    assert_eq!(r.mode, FidelityMode::NoSensorsActive);
}

#[test]
fn adapter_manifests_list_unsupported_items() {
    let r = default_fidelity_report();
    let ebpf = r
        .adapters
        .iter()
        .find(|m| m.adapter_id == AdapterId::LinuxEbpf)
        .unwrap();
    assert!(ebpf.requires_privilege_for_full_fidelity);
    assert!(
        ebpf.does_not_support_yet
            .iter()
            .any(|s| s.contains("bpf") || s.contains("ring")),
        "honest ebpf gap list: {:?}",
        ebpf.does_not_support_yet
    );
}

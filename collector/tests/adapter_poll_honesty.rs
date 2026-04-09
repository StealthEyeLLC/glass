use glass_collector::adapters::{AdapterError, LinuxEbpfAdapter, ProcfsProcessAdapter};
use glass_collector::CollectorAdapter;

#[test]
fn ebpf_adapter_poll_is_unsupported_not_silent_ok() {
    let mut a = LinuxEbpfAdapter;
    let r = a.poll_raw();
    assert!(matches!(r, Err(AdapterError::Unsupported(_))));
}

#[cfg(target_os = "linux")]
#[test]
fn procfs_poll_yields_samples_on_linux() {
    let mut a = ProcfsProcessAdapter::default();
    let r = a.poll_raw().unwrap();
    assert!(!r.is_empty());
    assert!(r
        .iter()
        .any(|x| { matches!(x.kind, glass_collector::RawObservationKind::ProcessSample) }));
}

#[cfg(not(target_os = "linux"))]
#[test]
fn procfs_poll_empty_off_linux() {
    let mut a = ProcfsProcessAdapter::default();
    assert!(a.poll_raw().unwrap().is_empty());
}

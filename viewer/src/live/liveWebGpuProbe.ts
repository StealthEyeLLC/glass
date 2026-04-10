/**
 * Honest WebGPU availability for the live visual bootstrap — no fake GPU.
 */

export type WebGpuLiveStatus =
  | "unavailable"
  | "available_but_not_initialized"
  | "initialized"
  | "failed_with_fallback";

/** True when `navigator.gpu` exists (API surface present; adapter may still be null). */
export function hasNavigatorGpu(nav: Navigator): boolean {
  return typeof nav.gpu !== "undefined" && nav.gpu !== null;
}

/**
 * Request an adapter. Returns `null` if `navigator.gpu` is missing or `requestAdapter` fails.
 */
export async function requestWebGpuAdapter(nav: Navigator): Promise<GPUAdapter | null> {
  if (!hasNavigatorGpu(nav)) {
    return null;
  }
  const gpu = nav.gpu;
  if (!gpu) {
    return null;
  }
  try {
    return await gpu.requestAdapter();
  } catch {
    return null;
  }
}

/**
 * Request a device from an adapter. Returns `null` on failure.
 */
export async function requestWebGpuDevice(adapter: GPUAdapter): Promise<GPUDevice | null> {
  try {
    return await adapter.requestDevice();
  } catch {
    return null;
  }
}

/**
 * Initial status from a synchronous navigator check (before any async init).
 */
export function initialWebGpuLiveStatus(nav: Navigator): WebGpuLiveStatus {
  if (!hasNavigatorGpu(nav)) {
    return "unavailable";
  }
  return "available_but_not_initialized";
}

/**
 * Human-readable one-line status for operator UI (implementation-facing).
 */
export function formatWebGpuLiveStatusLine(status: WebGpuLiveStatus): string {
  switch (status) {
    case "unavailable":
      return "WebGPU: unavailable — using Canvas 2D.";
    case "available_but_not_initialized":
      return "WebGPU: probing / initializing…";
    case "initialized":
      return "WebGPU: active (bootstrap: band + slot ticks; wire/detail text remains in panels below).";
    case "failed_with_fallback":
      return "WebGPU: initialization failed — using Canvas 2D.";
  }
}

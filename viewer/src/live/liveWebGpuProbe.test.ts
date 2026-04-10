import { describe, expect, it } from "vitest";
import {
  formatWebGpuLiveStatusLine,
  hasNavigatorGpu,
  initialWebGpuLiveStatus,
  requestWebGpuAdapter,
  requestWebGpuDevice,
} from "./liveWebGpuProbe.js";

describe("hasNavigatorGpu", () => {
  it("is false when gpu is undefined", () => {
    expect(hasNavigatorGpu({ gpu: undefined } as unknown as Navigator)).toBe(false);
  });

  it("is true when gpu is a non-null object", () => {
    expect(hasNavigatorGpu({ gpu: {} } as unknown as Navigator)).toBe(true);
  });
});

describe("initialWebGpuLiveStatus", () => {
  it("returns unavailable without gpu", () => {
    expect(initialWebGpuLiveStatus({ gpu: undefined } as unknown as Navigator)).toBe("unavailable");
  });

  it("returns available_but_not_initialized when gpu exists", () => {
    expect(initialWebGpuLiveStatus({ gpu: {} } as unknown as Navigator)).toBe(
      "available_but_not_initialized",
    );
  });
});

describe("formatWebGpuLiveStatusLine", () => {
  it("covers all statuses", () => {
    expect(formatWebGpuLiveStatusLine("unavailable")).toContain("Canvas 2D");
    expect(formatWebGpuLiveStatusLine("available_but_not_initialized")).toContain("initializing");
    expect(formatWebGpuLiveStatusLine("initialized")).toContain("WebGPU");
    expect(formatWebGpuLiveStatusLine("failed_with_fallback")).toContain("failed");
  });
});

describe("requestWebGpuAdapter", () => {
  it("returns null when gpu is missing", async () => {
    await expect(
      requestWebGpuAdapter({ gpu: undefined } as unknown as Navigator),
    ).resolves.toBeNull();
  });

  it("returns null when requestAdapter throws", async () => {
    const nav = {
      gpu: {
        requestAdapter: () => Promise.reject(new Error("no adapter")),
      },
    } as unknown as Navigator;
    await expect(requestWebGpuAdapter(nav)).resolves.toBeNull();
  });
});

describe("requestWebGpuDevice", () => {
  it("returns null when requestDevice throws", async () => {
    const adapter = {
      requestDevice: () => Promise.reject(new Error("no device")),
    } as unknown as GPUAdapter;
    await expect(requestWebGpuDevice(adapter)).resolves.toBeNull();
  });
});

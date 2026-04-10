import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialLiveSessionModelState } from "./applyLiveSessionMessage.js";
import { compileLiveToGlassSceneV0 } from "../scene/compileLiveScene.js";

vi.mock("./liveVisualWebGpu.js", () => ({
  renderLiveVisualWebGpuFrame: vi.fn(),
}));

import { paintLiveVisualSurface } from "./liveVisualRenderer.js";
import { renderLiveVisualWebGpuFrame } from "./liveVisualWebGpu.js";

const minimalBundle = {
  device: {} as GPUDevice,
  context: {} as GPUCanvasContext,
  format: "rgba8unorm" as GPUTextureFormat,
};

function liveScene() {
  return compileLiveToGlassSceneV0({
    model: createInitialLiveSessionModelState("s"),
    lastReconcile: null,
  });
}

describe("paintLiveVisualSurface", () => {
  beforeEach(() => {
    vi.mocked(renderLiveVisualWebGpuFrame).mockReset();
  });

  it("paints Canvas 2D and hides WebGPU + overlay when bundle is null", async () => {
    const c2d = document.createElement("canvas");
    const cgpu = document.createElement("canvas");
    const cover = document.createElement("canvas");
    const scene = liveScene();
    const r = await paintLiveVisualSurface(
      c2d,
      cgpu,
      cover,
      scene,
      { widthCss: 200, heightCss: 100 },
      null,
    );
    expect(r.webGpuActive).toBe(false);
    expect(r.hybridTextOverlayActive).toBe(false);
    expect(r.fallbackTextShouldHide).toBe(true);
    expect(cgpu.hidden).toBe(true);
    expect(cover.hidden).toBe(true);
    expect(c2d.hidden).toBe(false);
  });

  it("uses hybrid WebGPU + text overlay when GPU frame and overlay 2D succeed", async () => {
    vi.mocked(renderLiveVisualWebGpuFrame).mockResolvedValue(true);
    const c2d = document.createElement("canvas");
    const cgpu = document.createElement("canvas");
    const cover = document.createElement("canvas");
    const scene = liveScene();
    const r = await paintLiveVisualSurface(
      c2d,
      cgpu,
      cover,
      scene,
      { widthCss: 200, heightCss: 100 },
      minimalBundle,
    );
    expect(r.webGpuActive).toBe(true);
    expect(r.hybridTextOverlayActive).toBe(true);
    expect(r.fallbackTextShouldHide).toBe(true);
    expect(cgpu.hidden).toBe(false);
    expect(cover.hidden).toBe(false);
    expect(c2d.hidden).toBe(true);
  });

  it("falls back to full Canvas when WebGPU frame fails", async () => {
    vi.mocked(renderLiveVisualWebGpuFrame).mockResolvedValue(false);
    const c2d = document.createElement("canvas");
    const cgpu = document.createElement("canvas");
    const cover = document.createElement("canvas");
    const scene = liveScene();
    const r = await paintLiveVisualSurface(
      c2d,
      cgpu,
      cover,
      scene,
      { widthCss: 200, heightCss: 100 },
      minimalBundle,
    );
    expect(r.webGpuActive).toBe(false);
    expect(r.hybridTextOverlayActive).toBe(false);
    expect(cgpu.hidden).toBe(true);
    expect(cover.hidden).toBe(true);
    expect(c2d.hidden).toBe(false);
  });

  it("falls back to full Canvas when WebGPU succeeds but overlay cannot get 2d context", async () => {
    vi.mocked(renderLiveVisualWebGpuFrame).mockResolvedValue(true);
    const c2d = document.createElement("canvas");
    const cgpu = document.createElement("canvas");
    const cover = document.createElement("canvas");
    const overlayCtxSpy = vi.spyOn(cover, "getContext").mockReturnValue(null);
    const scene = liveScene();
    const r = await paintLiveVisualSurface(
      c2d,
      cgpu,
      cover,
      scene,
      { widthCss: 200, heightCss: 100 },
      minimalBundle,
    );
    expect(r.webGpuActive).toBe(false);
    expect(r.hybridTextOverlayActive).toBe(false);
    expect(cgpu.hidden).toBe(true);
    expect(cover.hidden).toBe(true);
    expect(c2d.hidden).toBe(false);
    overlayCtxSpy.mockRestore();
  });
});

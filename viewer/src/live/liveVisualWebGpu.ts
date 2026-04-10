/**
 * Minimal WebGPU bootstrap renderer for the bounded live visual — same geometry intent as Canvas 2D.
 * Does not draw text labels (use textual panels + legend); band + ticks + HTTP chip quads only.
 */

import { hasNavigatorGpu } from "./liveWebGpuProbe.js";
import {
  buildLiveVisualMarkersLayout,
  LIVE_VISUAL_BAND_LAYOUT,
  LIVE_VISUAL_TICK_GEOMETRY,
  LIVE_VISUAL_TICK_INACTIVE,
  liveVisualTickActiveFill,
} from "./liveVisualMarkers.js";
import {
  LIVE_VISUAL_MODE_FILL,
  type LiveVisualSpec,
  liveVisualDensity01,
} from "./liveVisualModel.js";
import type { LiveVisualCanvasLayout } from "./liveVisualCanvas.js";

const WGSL = `
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) @interpolate(flat) color: vec4f,
}
@vertex
fn vs_main(
  @location(0) pos: vec2f,
  @location(1) color: vec4f,
) -> VSOut {
  var o: VSOut;
  o.pos = vec4f(pos, 0.0, 1.0);
  o.color = color;
  return o;
}
@fragment
fn fs_main(in: VSOut) -> @location(0) vec4f {
  return in.color;
}
`;

const pipelineCache = new WeakMap<GPUDevice, Map<GPUTextureFormat, GPURenderPipeline>>();

function getSolidColorPipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  let byFormat = pipelineCache.get(device);
  if (!byFormat) {
    byFormat = new Map();
    pipelineCache.set(device, byFormat);
  }
  const hit = byFormat.get(format);
  if (hit) {
    return hit;
  }
  const module = device.createShaderModule({ label: "glass-live-visual-solid", code: WGSL });
  const pipeline = device.createRenderPipeline({
    label: "glass-live-visual-solid-pipeline",
    layout: "auto",
    vertex: {
      module,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 24,
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" },
            { shaderLocation: 1, offset: 8, format: "float32x4" },
          ],
        },
      ],
    },
    fragment: {
      module,
      entryPoint: "fs_main",
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list", cullMode: "none" },
  });
  byFormat.set(format, pipeline);
  return pipeline;
}

/** Parse #rrggbb to linear-ish RGBA for WebGPU (bootstrap; not color-managed). */
export function hexToRgba01(hex: string): [number, number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) {
    return [0.95, 0.97, 0.99, 1];
  }
  const n = Number.parseInt(m[1], 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  return [r, g, b, 1];
}

/** Top-left pixel coords → clip-space (NDC), y-down canvas to y-up NDC. */
export function pxRectToTriangleList(
  left: number,
  top: number,
  width: number,
  height: number,
  canvasW: number,
  canvasH: number,
  rgba: readonly [number, number, number, number],
): number[] {
  const right = left + width;
  const bottom = top + height;
  const c = rgba;
  const v = (x: number, y: number): number[] => {
    const nx = (x / canvasW) * 2 - 1;
    const ny = 1 - (y / canvasH) * 2;
    return [nx, ny, c[0], c[1], c[2], c[3]];
  };
  const a = v(left, top);
  const b = v(right, top);
  const d = v(left, bottom);
  const c2 = v(right, bottom);
  return [...a, ...b, ...d, ...b, ...c2, ...d];
}

export interface LiveVisualWebGpuBundle {
  device: GPUDevice;
  context: GPUCanvasContext;
  format: GPUTextureFormat;
}

/**
 * Acquire adapter/device/context and configure the canvas. Returns `null` on any failure.
 * Caller must not have obtained another context on the same canvas.
 */
export async function tryInitWebGpuCanvas(
  canvas: HTMLCanvasElement,
  nav: Navigator,
): Promise<LiveVisualWebGpuBundle | null> {
  if (!hasNavigatorGpu(nav)) {
    return null;
  }
  const gpu = nav.gpu;
  if (!gpu) {
    return null;
  }
  const adapter = await gpu.requestAdapter();
  if (!adapter) {
    return null;
  }
  let device: GPUDevice;
  try {
    device = await adapter.requestDevice();
  } catch {
    return null;
  }
  const context = canvas.getContext("webgpu");
  if (!context) {
    device.destroy();
    return null;
  }
  const format = gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: "premultiplied",
  });
  return { device, context, format };
}

/**
 * Build interleaved vertex data: `vec2 pos` + `vec4 color` per vertex, triangle list.
 */
export function buildLiveVisualWebGpuVertexData(
  spec: LiveVisualSpec,
  layout: LiveVisualCanvasLayout,
): Float32Array {
  const w = layout.widthCss;
  const h = layout.heightCss;
  const cw = w;
  const ch = h;
  const bg = hexToRgba01("#f1f5f9");
  const parts: number[] = [];
  parts.push(...pxRectToTriangleList(0, 0, w, h, cw, ch, bg));

  const bandColor = hexToRgba01(LIVE_VISUAL_MODE_FILL[spec.mode]);
  const density = liveVisualDensity01(spec.eventTailCount);
  const bandW = 16 + density * (w - 32);
  const bandH = LIVE_VISUAL_BAND_LAYOUT.height;
  const bandY = LIVE_VISUAL_BAND_LAYOUT.originY;
  parts.push(...pxRectToTriangleList(16, bandY, bandW, bandH, cw, ch, bandColor));

  const markers = buildLiveVisualMarkersLayout(spec, w);
  const tickTop = bandY + LIVE_VISUAL_TICK_GEOMETRY.insetTop;
  const tickH = bandH - LIVE_VISUAL_TICK_GEOMETRY.insetTop - LIVE_VISUAL_TICK_GEOMETRY.insetBottom;
  const tw = LIVE_VISUAL_TICK_GEOMETRY.widthPx;
  for (const t of markers.ticks) {
    const rgba = hexToRgba01(t.active ? liveVisualTickActiveFill(t.kind) : LIVE_VISUAL_TICK_INACTIVE);
    const left = t.centerX - tw / 2;
    parts.push(...pxRectToTriangleList(left, tickTop, tw, tickH, cw, ch, rgba));
  }

  const chip = markers.httpReconcile;
  if (chip.show) {
    const rgba = hexToRgba01("#f8fafc");
    parts.push(...pxRectToTriangleList(chip.x, chip.y, chip.width, chip.height, cw, ch, rgba));
  }

  return new Float32Array(parts);
}

/**
 * Configure canvas size, upload vertices, render one frame. Swallows errors (caller may fall back).
 * Awaits GPU completion before destroying the vertex buffer.
 */
export async function renderLiveVisualWebGpuFrame(
  canvas: HTMLCanvasElement,
  spec: LiveVisualSpec,
  layout: LiveVisualCanvasLayout,
  bundle: LiveVisualWebGpuBundle,
): Promise<boolean> {
  try {
    const dpr =
      typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
    const w = layout.widthCss;
    const h = layout.heightCss;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const pw = Math.max(1, Math.floor(w * dpr));
    const ph = Math.max(1, Math.floor(h * dpr));
    canvas.width = pw;
    canvas.height = ph;

    bundle.context.configure({
      device: bundle.device,
      format: bundle.format,
      alphaMode: "premultiplied",
    });

    const data = buildLiveVisualWebGpuVertexData(spec, layout);
    if (data.length === 0) {
      return false;
    }

    const device = bundle.device;
    const vb = device.createBuffer({
      label: "glass-live-visual-vb",
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vb, 0, data);

    const pipeline = getSolidColorPipeline(device, bundle.format);
    const encoder = device.createCommandEncoder({ label: "glass-live-visual-frame" });
    const view = bundle.context.getCurrentTexture().createView();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view,
          clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(pipeline);
    pass.setVertexBuffer(0, vb, 0, data.byteLength);
    pass.draw(data.length / 6, 1, 0, 0);
    pass.end();
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    vb.destroy();
    return true;
  } catch {
    return false;
  }
}

/**
 * Minimal WebGPU bootstrap renderer for the bounded live visual — consumes the same `DrawablePrimitive[]`
 * as Canvas 2D (`sceneToDrawablePrimitives` / `buildBoundedVisualGeometryPrimitives`).
 * Does not draw text labels (use textual panels + legend); solid fills + stroke rects expanded to thin quads only.
 */

import type { GlassSceneV0 } from "../scene/glassSceneV0.js";
import {
  buildBoundedVisualGeometryPrimitives,
  expandStrokeRectToFillRects,
  type DrawablePrimitive,
} from "../scene/drawablePrimitivesV0.js";
import { sceneToDrawablePrimitives } from "../scene/sceneToDrawablePrimitives.js";
import { hasNavigatorGpu } from "./liveWebGpuProbe.js";
import type { LiveVisualSpec } from "./liveVisualModel.js";
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

function appendFillPrimitiveToParts(
  parts: number[],
  p: Extract<DrawablePrimitive, { kind: "fill_rect" }>,
  cw: number,
  ch: number,
): void {
  const rgba = hexToRgba01(p.fillColorHex);
  parts.push(...pxRectToTriangleList(p.x, p.y, p.width, p.height, cw, ch, rgba));
}

/**
 * Interleaved vertex data from drawable primitives: `vec2 pos` + `vec4 color` per vertex, triangle list.
 * Stroke rects are expanded to thin fill quads (same visual intent as Canvas `strokeRect`).
 */
export function buildDrawablePrimitivesWebGpuVertexData(
  primitives: readonly DrawablePrimitive[],
  layout: LiveVisualCanvasLayout,
): Float32Array {
  const cw = layout.widthCss;
  const ch = layout.heightCss;
  const parts: number[] = [];
  for (const p of primitives) {
    if (p.kind === "fill_rect") {
      appendFillPrimitiveToParts(parts, p, cw, ch);
    } else {
      for (const f of expandStrokeRectToFillRects(p)) {
        appendFillPrimitiveToParts(parts, f, cw, ch);
      }
    }
  }
  return new Float32Array(parts);
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
 * Build interleaved vertex data from a live visual spec (test / legacy entry); prefer `buildDrawablePrimitivesWebGpuVertexData(sceneToDrawablePrimitives(scene), layout)`.
 */
export function buildLiveVisualWebGpuVertexData(
  spec: LiveVisualSpec,
  layout: LiveVisualCanvasLayout,
): Float32Array {
  const w = layout.widthCss;
  const h = layout.heightCss;
  return buildDrawablePrimitivesWebGpuVertexData(buildBoundedVisualGeometryPrimitives(spec, w, h), layout);
}

/**
 * Configure canvas size, upload vertices, render one frame. Swallows errors (caller may fall back).
 * Awaits GPU completion before destroying the vertex buffer.
 */
export async function renderLiveVisualWebGpuFrame(
  canvas: HTMLCanvasElement,
  scene: GlassSceneV0,
  layout: LiveVisualCanvasLayout,
  bundle: LiveVisualWebGpuBundle,
  options?: { focusedSelectionId?: string | null },
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

    const primitives = sceneToDrawablePrimitives(scene, layout, {
      focusedSelectionId: options?.focusedSelectionId ?? null,
    });
    const data = buildDrawablePrimitivesWebGpuVertexData(primitives, layout);
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

import { afterEach, describe, expect, it, vi } from "vitest";
import { mountLiveSessionShell } from "./liveSessionShell.js";

describe("mountLiveSessionShell", () => {
  it("mounts live state panel and bounded event region", () => {
    const root = document.createElement("div");
    mountLiveSessionShell(root);
    expect(root.querySelector('[data-testid="live-state-panel"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-event-list"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-tail-origin"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-connect"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-disconnect"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-ws-status"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-session-log"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-log-intro"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-visual-surface"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-visual-canvas"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-visual-fallback"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-visual-gpu-status"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-visual-canvas-webgpu"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="live-visual-canvas-text-overlay"]')).not.toBeNull();
    const prov = root.querySelector('[data-testid="live-visual-provenance-strip"]');
    expect(prov).not.toBeNull();
    expect((prov?.textContent ?? "").toLowerCase()).toContain("renderer=");
    const legend = root.querySelector('[data-testid="live-visual-legend"]');
    expect(legend).not.toBeNull();
    const lt = legend?.textContent ?? "";
    expect(lt).toContain("R = ");
    expect(lt).toContain("HTTP = ");
    expect(lt.toLowerCase()).toContain("not a timeline");
  });
});

describe("live visual provenance copy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("logs success when JSON copy succeeds", async () => {
    const writeText = vi.fn(() => Promise.resolve(undefined));
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    });
    const root = document.createElement("div");
    mountLiveSessionShell(root);
    expect(root.querySelector('[data-testid="live-visual-provenance-copy-json"]')).not.toBeNull();
    (root.querySelector('[data-testid="live-visual-provenance-copy-json"]') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    const log = root.querySelector('[data-testid="live-session-log"]') as HTMLElement;
    await vi.waitFor(() => {
      expect(log.textContent).toContain("provenance copied to clipboard (JSON v0)");
    });
    const written = writeText.mock.calls[0][0] as string;
    expect(written).toContain("glass_live_visual_provenance_v0");
  });

  it("logs failure when clipboard rejects", async () => {
    const writeText = vi.fn(() => Promise.reject(new Error("clipboard denied")));
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText },
    });
    const root = document.createElement("div");
    mountLiveSessionShell(root);
    (root.querySelector('[data-testid="live-visual-provenance-copy-json"]') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      const log = root.querySelector('[data-testid="live-session-log"]') as HTMLElement;
      expect(log.textContent).toContain("provenance copy failed");
    });
  });
});

describe("live shell WebSocket lifecycle (deterministic mock)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records operator disconnect with close code in ws status JSON", async () => {
    class FakeWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 3;
      url: string;
      readyState = FakeWebSocket.CONNECTING;
      private listeners: Record<string, Array<(e: unknown) => void>> = {};

      constructor(url: string) {
        this.url = url;
        queueMicrotask(() => {
          this.readyState = FakeWebSocket.OPEN;
          this.emit("open", {});
        });
      }

      addEventListener(ev: string, fn: (e: unknown) => void): void {
        if (!this.listeners[ev]) {
          this.listeners[ev] = [];
        }
        this.listeners[ev].push(fn);
      }

      private emit(ev: string, payload: unknown): void {
        for (const fn of this.listeners[ev] ?? []) {
          fn(payload);
        }
      }

      send(): void {}

      close(code?: number, reason?: string): void {
        this.readyState = FakeWebSocket.CLOSED;
        this.emit("close", {
          code: code ?? 1000,
          reason: reason ?? "",
          wasClean: true,
          target: this,
        });
      }
    }

    vi.stubGlobal("WebSocket", FakeWebSocket);

    const root = document.createElement("div");
    mountLiveSessionShell(root);
    const urlIn = root.querySelector('[data-testid="live-bridge-url"]') as HTMLInputElement;
    const tok = root.querySelector('[data-testid="live-token"]') as HTMLInputElement;
    const sid = root.querySelector('[data-testid="live-session-id"]') as HTMLInputElement;
    urlIn.value = "http://127.0.0.1:9";
    tok.value = "tok";
    sid.value = "sess1";

    (root.querySelector('[data-testid="live-connect"]') as HTMLButtonElement).click();

    await vi.waitFor(() => {
      const pre = root.querySelector('[data-testid="live-ws-status"]') as HTMLElement;
      expect(pre.textContent).toContain('"phase": "open"');
    });

    (root.querySelector('[data-testid="live-disconnect"]') as HTMLButtonElement).click();

    await vi.waitFor(() => {
      const pre = root.querySelector('[data-testid="live-ws-status"]') as HTMLElement;
      const t = pre.textContent ?? "";
      expect(t).toContain("operator_disconnect");
      expect(t).toContain('"code": 1000');
    });
  });

  it("reconnect clears prior close display when opening a new socket", async () => {
    class FakeWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 3;
      url: string;
      readyState = FakeWebSocket.CONNECTING;
      private listeners: Record<string, Array<(e: unknown) => void>> = {};

      constructor(url: string) {
        this.url = url;
        queueMicrotask(() => {
          this.readyState = FakeWebSocket.OPEN;
          this.emit("open", {});
        });
      }

      addEventListener(ev: string, fn: (e: unknown) => void): void {
        if (!this.listeners[ev]) {
          this.listeners[ev] = [];
        }
        this.listeners[ev].push(fn);
      }

      private emit(ev: string, payload: unknown): void {
        for (const fn of this.listeners[ev] ?? []) {
          fn(payload);
        }
      }

      send(): void {}

      close(code?: number, reason?: string): void {
        this.readyState = FakeWebSocket.CLOSED;
        this.emit("close", {
          code: code ?? 1000,
          reason: reason ?? "",
          wasClean: true,
          target: this,
        });
      }
    }

    vi.stubGlobal("WebSocket", FakeWebSocket);

    const root = document.createElement("div");
    mountLiveSessionShell(root);
    const urlIn = root.querySelector('[data-testid="live-bridge-url"]') as HTMLInputElement;
    const tok = root.querySelector('[data-testid="live-token"]') as HTMLInputElement;
    const sid = root.querySelector('[data-testid="live-session-id"]') as HTMLInputElement;
    urlIn.value = "http://127.0.0.1:9";
    tok.value = "tok";
    sid.value = "sess1";

    (root.querySelector('[data-testid="live-connect"]') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(
        (root.querySelector('[data-testid="live-ws-status"]') as HTMLElement).textContent,
      ).toContain('"phase": "open"');
    });

    (root.querySelector('[data-testid="live-disconnect"]') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      expect(
        (root.querySelector('[data-testid="live-ws-status"]') as HTMLElement).textContent,
      ).toContain("operator_disconnect");
    });

    (root.querySelector('[data-testid="live-connect"]') as HTMLButtonElement).click();
    await vi.waitFor(() => {
      const t =
        (root.querySelector('[data-testid="live-ws-status"]') as HTMLElement).textContent ?? "";
      expect(t).toContain('"phase": "open"');
      expect(t).not.toContain("operator_disconnect");
    });
  });
});

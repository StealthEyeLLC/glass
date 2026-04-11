/**
 * Vertical Slice v30 — explicit easy vs technical product surfaces (same bounded truth; different chrome).
 * URL: `?surface=technical` shows the full instrument; default / omitted `surface` is Overview (easy).
 */

export type GlassSurface = "easy" | "technical";

export function parseGlassSurface(search: string): GlassSurface {
  const q = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(q).get("surface") === "technical" ? "technical" : "easy";
}

export function syncGlassSurfaceUrl(surface: GlassSurface): void {
  const u = new URL(window.location.href);
  if (surface === "easy") {
    u.searchParams.delete("surface");
  } else {
    u.searchParams.set("surface", "technical");
  }
  history.replaceState({}, "", `${u.pathname}${u.search}${u.hash}`);
}

export interface GlassSurfaceControls {
  getSurface: () => GlassSurface;
  setSurface: (surface: GlassSurface) => void;
}

/**
 * Prepends the Overview / Technical control strip and keeps `data-surface` + URL in sync.
 */
export function mountGlassSurfaceControls(root: HTMLElement): GlassSurfaceControls {
  let surface = parseGlassSurface(window.location.search);
  root.dataset.surface = surface;

  const bar = document.createElement("div");
  bar.className = "glass-surface-bar";
  bar.setAttribute("data-testid", "glass-surface-bar");
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", "View");

  const label = document.createElement("span");
  label.className = "glass-surface-bar-label";
  label.textContent = "View";

  const seg = document.createElement("div");
  seg.className = "glass-surface-segmented";
  seg.setAttribute("role", "tablist");
  seg.setAttribute("aria-label", "Easy or technical surface");

  const btnEasy = document.createElement("button");
  btnEasy.type = "button";
  btnEasy.className = "glass-surface-segment";
  btnEasy.setAttribute("data-testid", "glass-surface-easy");
  btnEasy.setAttribute("role", "tab");
  btnEasy.textContent = "Overview";
  btnEasy.title = "Default surface — fewer words, same bounded story";

  const btnTech = document.createElement("button");
  btnTech.type = "button";
  btnTech.className = "glass-surface-segment";
  btnTech.setAttribute("data-testid", "glass-surface-technical");
  btnTech.setAttribute("role", "tab");
  btnTech.textContent = "Technical";
  btnTech.title = "Full instrument — ids, scope, receipts, operator detail";

  function paintButtons(): void {
    const easySel = surface === "easy";
    btnEasy.setAttribute("aria-selected", easySel ? "true" : "false");
    btnTech.setAttribute("aria-selected", easySel ? "false" : "true");
    btnEasy.classList.toggle("glass-surface-segment--selected", easySel);
    btnTech.classList.toggle("glass-surface-segment--selected", !easySel);
  }

  function apply(next: GlassSurface, fromUrl: boolean): void {
    surface = next;
    root.dataset.surface = surface;
    paintButtons();
    if (!fromUrl) {
      syncGlassSurfaceUrl(surface);
    }
  }

  btnEasy.addEventListener("click", () => {
    apply("easy", false);
  });
  btnTech.addEventListener("click", () => {
    apply("technical", false);
  });

  window.addEventListener("popstate", () => {
    const next = parseGlassSurface(window.location.search);
    apply(next, true);
  });

  seg.append(btnEasy, btnTech);
  bar.append(label, seg);
  root.prepend(bar);
  paintButtons();

  return {
    getSurface: () => surface,
    setSurface: (s: GlassSurface) => {
      apply(s, false);
    },
  };
}

/** Build `?live=1` link preserving optional `surface` and other params (e.g. fixture). */
export function buildLiveSessionHref(): string {
  const u = new URL(window.location.href);
  u.searchParams.set("live", "1");
  return `${u.pathname}${u.search}${u.hash}`;
}

/** Replay URL with `live` removed; keeps `surface` and other params. */
export function buildReplayHrefFromLive(): string {
  const u = new URL(window.location.href);
  u.searchParams.delete("live");
  return `${u.pathname}${u.search}${u.hash}`;
}

/** Dev flagship loader: preserve surface. */
export function buildFlagshipDevHref(): string {
  const u = new URL(window.location.href);
  u.searchParams.set("fixture", "flagship");
  return `${u.pathname}${u.search}${u.hash}`;
}

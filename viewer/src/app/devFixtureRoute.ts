/**
 * Dev-only Vertical Slice v0 fixture loading via `?fixture=vertical_slice_v0`.
 * Vite `npm run dev` serves bytes at {@link VERTICAL_SLICE_V0_DEV_FETCH_PATH}; production/static
 * builds set `import.meta.env.DEV === false` — no fetch, no exposure.
 */

export const FIXTURE_QUERY_PARAM = "fixture" as const;

/** Single supported dev auto-load key (synthetic pack under tests/fixtures/). */
export const VERTICAL_SLICE_V0_FIXTURE_QUERY_VALUE = "vertical_slice_v0" as const;

/** Dev server only — middleware in vite.config.ts; absent from `dist/`. */
export const VERTICAL_SLICE_V0_DEV_FETCH_PATH =
  "/__glass__/dev/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack" as const;

export const VERTICAL_SLICE_V0_DEV_FILE_NAME =
  "glass_vertical_slice_v0_tier_b.glass_pack" as const;

export function shouldOfferDevFixtureLoad(env: { DEV?: boolean }): boolean {
  return env.DEV === true;
}

export function parseDevFixtureQuery(search: string): string | null {
  const v = new URLSearchParams(
    search.startsWith("?") ? search : `?${search}`,
  ).get(FIXTURE_QUERY_PARAM);
  return v === VERTICAL_SLICE_V0_FIXTURE_QUERY_VALUE ? v : null;
}

export type DevFixturePlan =
  | { kind: "none" }
  | {
      kind: "load_vertical_slice_v0";
      url: string;
      fileName: string;
    };

/** Pure — used by replay shell and tests (no I/O). */
export function planDevFixtureLoad(
  search: string,
  env: { DEV?: boolean },
): DevFixturePlan {
  if (!shouldOfferDevFixtureLoad(env)) {
    return { kind: "none" };
  }
  if (parseDevFixtureQuery(search) !== VERTICAL_SLICE_V0_FIXTURE_QUERY_VALUE) {
    return { kind: "none" };
  }
  return {
    kind: "load_vertical_slice_v0",
    url: VERTICAL_SLICE_V0_DEV_FETCH_PATH,
    fileName: VERTICAL_SLICE_V0_DEV_FILE_NAME,
  };
}

/** Remove `fixture=vertical_slice_v0` after a successful load so refresh does not re-fetch. */
export function stripVerticalSliceDevFixtureQuery(): void {
  if (typeof window === "undefined") {
    return;
  }
  const u = new URL(window.location.href);
  if (u.searchParams.get(FIXTURE_QUERY_PARAM) !== VERTICAL_SLICE_V0_FIXTURE_QUERY_VALUE) {
    return;
  }
  u.searchParams.delete(FIXTURE_QUERY_PARAM);
  const q = u.searchParams.toString();
  const next = `${u.pathname}${q ? `?${q}` : ""}${u.hash}`;
  history.replaceState({}, "", next);
}

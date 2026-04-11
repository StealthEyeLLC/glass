/**
 * Dev-only Tier B fixture loading via `?fixture=…` (Vertical Slice v0 minimal + v18 flagship).
 * Vite `npm run dev` serves bytes at dev fetch paths; production/static builds set
 * `import.meta.env.DEV === false` — no fetch, no exposure.
 */

export const FIXTURE_QUERY_PARAM = "fixture" as const;

/** Minimal CI / fast smoke pack (3 events). */
export const VERTICAL_SLICE_V0_FIXTURE_QUERY_VALUE = "vertical_slice_v0" as const;

/** Vertical Slice v18 flagship — canonical append-heavy path (see docs). */
export const FLAGSHIP_V18_FIXTURE_QUERY_VALUE = "flagship" as const;

export type DevFixtureQueryValue =
  | typeof VERTICAL_SLICE_V0_FIXTURE_QUERY_VALUE
  | typeof FLAGSHIP_V18_FIXTURE_QUERY_VALUE;

/** Dev server only — middleware in vite.config.ts; absent from `dist/`. */
export const VERTICAL_SLICE_V0_DEV_FETCH_PATH =
  "/__glass__/dev/vertical_slice_v0/glass_vertical_slice_v0_tier_b.glass_pack" as const;

export const VERTICAL_SLICE_V0_DEV_FILE_NAME =
  "glass_vertical_slice_v0_tier_b.glass_pack" as const;

export const FLAGSHIP_V18_DEV_FETCH_PATH =
  "/__glass__/dev/canonical_scenarios_v15/canonical_v15_append_heavy.glass_pack" as const;

export const FLAGSHIP_V18_DEV_FILE_NAME = "canonical_v15_append_heavy.glass_pack" as const;

export function shouldOfferDevFixtureLoad(env: { DEV?: boolean }): boolean {
  return env.DEV === true;
}

export function parseDevFixtureQuery(search: string): DevFixtureQueryValue | null {
  const v = new URLSearchParams(
    search.startsWith("?") ? search : `?${search}`,
  ).get(FIXTURE_QUERY_PARAM);
  if (v === VERTICAL_SLICE_V0_FIXTURE_QUERY_VALUE) {
    return VERTICAL_SLICE_V0_FIXTURE_QUERY_VALUE;
  }
  if (v === FLAGSHIP_V18_FIXTURE_QUERY_VALUE) {
    return FLAGSHIP_V18_FIXTURE_QUERY_VALUE;
  }
  return null;
}

export type DevFixturePlan =
  | { kind: "none" }
  | {
      kind: "load_dev_pack";
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
  const key = parseDevFixtureQuery(search);
  if (key === VERTICAL_SLICE_V0_FIXTURE_QUERY_VALUE) {
    return {
      kind: "load_dev_pack",
      url: VERTICAL_SLICE_V0_DEV_FETCH_PATH,
      fileName: VERTICAL_SLICE_V0_DEV_FILE_NAME,
    };
  }
  if (key === FLAGSHIP_V18_FIXTURE_QUERY_VALUE) {
    return {
      kind: "load_dev_pack",
      url: FLAGSHIP_V18_DEV_FETCH_PATH,
      fileName: FLAGSHIP_V18_DEV_FILE_NAME,
    };
  }
  return { kind: "none" };
}

/** Remove known `fixture=` values after a successful load so refresh does not re-fetch. */
export function stripVerticalSliceDevFixtureQuery(): void {
  if (typeof window === "undefined") {
    return;
  }
  const u = new URL(window.location.href);
  const cur = u.searchParams.get(FIXTURE_QUERY_PARAM);
  if (
    cur !== VERTICAL_SLICE_V0_FIXTURE_QUERY_VALUE &&
    cur !== FLAGSHIP_V18_FIXTURE_QUERY_VALUE
  ) {
    return;
  }
  u.searchParams.delete(FIXTURE_QUERY_PARAM);
  const q = u.searchParams.toString();
  const next = `${u.pathname}${q ? `?${q}` : ""}${u.hash}`;
  history.replaceState({}, "", next);
}

import { describe, expect, it } from "vitest";
import {
  FIXTURE_QUERY_PARAM,
  FLAGSHIP_V18_DEV_FETCH_PATH,
  FLAGSHIP_V18_DEV_FILE_NAME,
  FLAGSHIP_V18_FIXTURE_QUERY_VALUE,
  VERTICAL_SLICE_V0_DEV_FETCH_PATH,
  VERTICAL_SLICE_V0_DEV_FILE_NAME,
  parseDevFixtureQuery,
  planDevFixtureLoad,
  shouldOfferDevFixtureLoad,
  stripVerticalSliceDevFixtureQuery,
  VERTICAL_SLICE_V0_FIXTURE_QUERY_VALUE,
} from "./devFixtureRoute.js";

describe("devFixtureRoute", () => {
  it("parses vertical_slice_v0 and flagship", () => {
    expect(parseDevFixtureQuery("?fixture=vertical_slice_v0")).toBe(
      VERTICAL_SLICE_V0_FIXTURE_QUERY_VALUE,
    );
    expect(parseDevFixtureQuery("?fixture=flagship")).toBe(FLAGSHIP_V18_FIXTURE_QUERY_VALUE);
    expect(parseDevFixtureQuery("")).toBeNull();
    expect(parseDevFixtureQuery("?fixture=other")).toBeNull();
    expect(parseDevFixtureQuery(`?${FIXTURE_QUERY_PARAM}=vertical_slice_v0`)).toBe(
      VERTICAL_SLICE_V0_FIXTURE_QUERY_VALUE,
    );
  });

  it("shouldOfferDevFixtureLoad is true only when DEV is true", () => {
    expect(shouldOfferDevFixtureLoad({ DEV: true })).toBe(true);
    expect(shouldOfferDevFixtureLoad({ DEV: false })).toBe(false);
    expect(shouldOfferDevFixtureLoad({})).toBe(false);
  });

  it("planDevFixtureLoad is inert when DEV is false (production / static build)", () => {
    expect(
      planDevFixtureLoad("?fixture=vertical_slice_v0", { DEV: false }),
    ).toEqual({ kind: "none" });
    expect(planDevFixtureLoad("?fixture=flagship", { DEV: false })).toEqual({ kind: "none" });
    expect(planDevFixtureLoad("", { DEV: false })).toEqual({ kind: "none" });
  });

  it("planDevFixtureLoad resolves vertical_slice_v0 in dev", () => {
    expect(planDevFixtureLoad("?fixture=vertical_slice_v0", { DEV: true })).toEqual({
      kind: "load_dev_pack",
      url: VERTICAL_SLICE_V0_DEV_FETCH_PATH,
      fileName: VERTICAL_SLICE_V0_DEV_FILE_NAME,
    });
  });

  it("planDevFixtureLoad resolves flagship append-heavy pack in dev", () => {
    expect(planDevFixtureLoad("?fixture=flagship", { DEV: true })).toEqual({
      kind: "load_dev_pack",
      url: FLAGSHIP_V18_DEV_FETCH_PATH,
      fileName: FLAGSHIP_V18_DEV_FILE_NAME,
    });
  });

  it("planDevFixtureLoad ignores unknown fixture keys in dev", () => {
    expect(planDevFixtureLoad("?fixture=nope", { DEV: true })).toEqual({
      kind: "none",
    });
  });

  it("stripVerticalSliceDevFixtureQuery removes fixture param for known keys", () => {
    history.replaceState({}, "", "/?fixture=vertical_slice_v0&live=0");
    stripVerticalSliceDevFixtureQuery();
    expect(window.location.search).not.toContain("fixture=");
    expect(window.location.pathname).toBe("/");
    history.replaceState({}, "", "/?fixture=flagship");
    stripVerticalSliceDevFixtureQuery();
    expect(window.location.search).toBe("");
  });
});

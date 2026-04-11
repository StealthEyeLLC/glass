import { describe, expect, it } from "vitest";
import { parseGlassSurface } from "./glassSurface.js";

describe("glassSurface", () => {
  it("defaults to easy", () => {
    expect(parseGlassSurface("")).toBe("easy");
    expect(parseGlassSurface("?")).toBe("easy");
    expect(parseGlassSurface("?live=1")).toBe("easy");
    expect(parseGlassSurface("?fixture=flagship")).toBe("easy");
  });

  it("parses technical", () => {
    expect(parseGlassSurface("?surface=technical")).toBe("technical");
    expect(parseGlassSurface("?live=1&surface=technical")).toBe("technical");
  });
});

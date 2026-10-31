import { describe, expect, it } from "vitest";
import { sourceLocation } from "./evidence";

describe("sourceLocation", () => {
  it("shows available source information only", () => {
    expect(sourceLocation("Section 4.2", null)).toBe("Section 4.2");
    expect(sourceLocation(null, 3)).toBe("Page 3");
  });
  it("does not fabricate unavailable page or section references", () => {
    expect(sourceLocation(null, null)).toBe("Source location unavailable");
  });
});

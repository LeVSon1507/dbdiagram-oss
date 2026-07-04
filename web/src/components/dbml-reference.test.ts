import { describe, expect, it } from "vitest";

import { filterDbmlReference } from "./dbml-reference";

describe("filterDbmlReference", () => {
  it("finds syntax groups by keyword and description", () => {
    expect(filterDbmlReference("cascade")[0]?.title).toBe("Relationships");
    expect(filterDbmlReference("tái sử dụng")[0]?.title).toBe("TablePartial");
  });

  it("returns the complete reference for an empty query", () => {
    expect(filterDbmlReference("")).toHaveLength(14);
  });
});

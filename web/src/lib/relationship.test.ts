import { describe, expect, it } from "vitest";

import { cardinalityLabel, relationshipLabel } from "./relationship";

describe("relationship cardinality", () => {
  it.each([
    ["1", "1"],
    ["*", "N"],
    ["N", "N"],
  ])("maps %s to %s", (value, expected) => {
    expect(cardinalityLabel(value)).toBe(expected);
  });

  it.each([
    ["1", "*", "1 : N"],
    ["*", "1", "N : 1"],
    ["*", "*", "N : N"],
  ])("formats %s to %s as %s", (source, target, expected) => {
    expect(relationshipLabel(source, target)).toBe(expected);
  });
});

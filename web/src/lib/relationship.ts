export type CardinalityLabel = "1" | "N";

export function cardinalityLabel(value: string): CardinalityLabel {
  return value === "1" ? "1" : "N";
}

export function relationshipLabel(
  sourceCardinality: string,
  targetCardinality: string,
): string {
  return `${cardinalityLabel(sourceCardinality)} : ${cardinalityLabel(
    targetCardinality,
  )}`;
}

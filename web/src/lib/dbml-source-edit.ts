export const DBML_COLUMN_TYPES = [
  "smallint",
  "integer",
  "bigint",
  "serial",
  "bigserial",
  "decimal(10,2)",
  "numeric",
  "real",
  "double",
  "varchar(255)",
  "char(1)",
  "text",
  "boolean",
  "date",
  "time",
  "timestamp",
  "timestamptz",
  "json",
  "jsonb",
  "uuid",
  "bytea",
] as const;

function tableBlockEnd(source: string, openingBrace: number): number | undefined {
  let depth = 0;
  let quote: "'" | '"' | "`" | undefined;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingBrace; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && nextCharacter === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (character === "\\" && nextCharacter) {
        index += 1;
      } else if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (character === "/" && nextCharacter === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character !== "}") continue;

    depth -= 1;
    if (depth === 0) return index;
  }

  return undefined;
}

export function updateDbmlFieldType(
  source: string,
  tableId: string,
  fieldName: string,
  nextType: string,
): string {
  const separatorIndex = tableId.indexOf(".");
  const schemaName =
    separatorIndex === -1 ? "public" : tableId.slice(0, separatorIndex);
  const tableName =
    separatorIndex === -1 ? tableId : tableId.slice(separatorIndex + 1);
  const tablePattern =
    /^[ \t]*Table[ \t]+(?:(?:"([^"]+)"|([A-Za-z_]\w*))\.)?(?:"([^"]+)"|([A-Za-z_]\w*))[^{\r\n]*\{/gm;

  for (const match of source.matchAll(tablePattern)) {
    const matchedSchemaName = match[1] ?? match[2] ?? "public";
    const matchedTableName = match[3] ?? match[4];
    if (
      matchedSchemaName !== schemaName ||
      matchedTableName !== tableName ||
      match.index === undefined
    ) {
      continue;
    }

    const openingBrace = match.index + match[0].lastIndexOf("{");
    const closingBrace = tableBlockEnd(source, openingBrace);
    if (closingBrace === undefined) return source;

    const block = source.slice(openingBrace + 1, closingBrace);
    const fieldPattern =
      /^([ \t]*)(?:"([^"]+)"|([A-Za-z_]\w*))([ \t]+)([A-Za-z_][\w.]*(?:\([^)\r\n]*\))?)(?=[ \t]*(?:\[|$))/gm;

    for (const fieldMatch of block.matchAll(fieldPattern)) {
      const matchedFieldName = fieldMatch[2] ?? fieldMatch[3];
      if (matchedFieldName !== fieldName || fieldMatch.index === undefined) {
        continue;
      }

      const typeOffset = fieldMatch[0].lastIndexOf(fieldMatch[5]);
      const typeStart = openingBrace + 1 + fieldMatch.index + typeOffset;
      return `${source.slice(0, typeStart)}${nextType}${source.slice(
        typeStart + fieldMatch[5].length,
      )}`;
    }

    return source;
  }

  return source;
}

import { describe, expect, it } from "vitest";

import { parseDbml } from "./schema";

const source = `
Table users [headercolor: #2563eb] {
  id integer [pk, increment]
  email varchar [not null, unique]
}

Table posts {
  id integer [pk]
  author_id integer [not null]
}

Ref: posts.author_id > users.id
`;

describe("parseDbml", () => {
  it("maps tables, fields and references to the diagram model", () => {
    const result = parseDbml(source);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.schema.tables).toHaveLength(2);
    expect(result.schema.tables[0]).toMatchObject({
      id: "public.users",
      name: "users",
      color: "#2563eb",
    });
    expect(result.schema.tables[0].fields[1]).toMatchObject({
      name: "email",
      type: "varchar",
      unique: true,
      nullable: false,
    });
    expect(result.schema.relations[0]).toMatchObject({
      sourceTableId: "public.posts",
      sourceCardinality: "*",
      targetTableId: "public.users",
      targetCardinality: "1",
    });
  });

  it("returns the source location for invalid DBML", () => {
    const result = parseDbml("Table users {");

    expect(result).toEqual({
      ok: false,
      error: {
        message: "Expect a closing brace '}'",
        line: 1,
        column: 14,
      },
    });
  });
});

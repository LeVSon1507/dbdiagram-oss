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
    expect(result.schema.tables[0]).toMatchObject({
      indexes: [],
      checks: [],
    });
    expect(result.schema.relations[0]).toMatchObject({
      sourceTableId: "public.posts",
      sourceCardinality: "*",
      targetTableId: "public.users",
      targetCardinality: "1",
      foreignTableId: "public.posts",
      foreignFieldNames: ["author_id"],
      referencedTableId: "public.users",
      referencedFieldNames: ["id"],
    });
  });

  it("maps defaults, indexes, checks, and reference actions", () => {
    const result = parseDbml(`
Table users {
  id bigint [pk]
  email varchar(255) [not null, default: 'unknown']
  age integer [check: \`age > 0\`]
  indexes {
    email [name: 'idx_users_email', unique]
  }
  checks {
    \`age < 150\` [name: 'age_max']
  }
}
Table posts {
  id bigint [pk]
  user_id bigint
}
Ref fk_posts_users: posts.user_id > users.id [delete: cascade, update: restrict]
`);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.schema.tables[0].fields[1].defaultValue).toEqual({
      type: "string",
      value: "unknown",
    });
    expect(result.schema.tables[0].indexes[0]).toMatchObject({
      name: "idx_users_email",
      columns: [{ type: "column", value: "email" }],
      unique: true,
    });
    expect(result.schema.tables[0].checks[0]).toMatchObject({
      name: "age_max",
      expression: "age < 150",
    });
    expect(result.schema.relations[0]).toMatchObject({
      name: "fk_posts_users",
      onDelete: "cascade",
      onUpdate: "restrict",
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

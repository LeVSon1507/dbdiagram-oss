import { describe, expect, it } from "vitest";

import { parseDbml } from "./schema";
import { diffSchemas } from "./schema-diff";

function schema(source: string) {
  const result = parseDbml(source);
  if (!result.ok) throw new Error(result.error.message);
  return result.schema;
}

describe("semantic schema diff", () => {
  it("detects tables, columns, indexes, checks, and relationships", () => {
    const before = schema(`
Table users {
  id bigint [pk]
  email varchar
}
`);
    const after = schema(`
Table users {
  id bigint [pk]
  email varchar(255) [not null, unique]
  age integer
  indexes {
    email [name: 'idx_users_email']
  }
  checks {
    \`age >= 0\` [name: 'age_positive']
  }
}
Table posts {
  id bigint [pk]
  user_id bigint
}
Ref: posts.user_id > users.id
`);

    const changes = diffSchemas(before, after);
    expect(
      changes.map((change) => `${change.kind}:${change.target}`),
    ).toEqual(
      expect.arrayContaining([
        "modify:column",
        "add:column",
        "add:index",
        "add:check",
        "add:table",
        "add:relationship",
      ]),
    );
  });

  it("does not infer renames", () => {
    const before = schema("Table users {\n id bigint [pk]\n}");
    const after = schema("Table accounts {\n id bigint [pk]\n}");

    expect(diffSchemas(before, after).map((change) => change.kind)).toEqual([
      "remove",
      "add",
    ]);
  });

  it("applies explicit table and column rename mappings", () => {
    const before = schema(
      "Table users {\n id bigint [pk]\n name varchar\n}",
    );
    const after = schema(
      "Table accounts {\n id bigint [pk]\n display_name varchar\n}",
    );

    const changes = diffSchemas(before, after, [
      { target: "table", from: "public.users", to: "public.accounts" },
      {
        target: "column",
        from: "public.users.name",
        to: "public.accounts.display_name",
      },
    ]);

    expect(changes.map((change) => `${change.kind}:${change.target}`)).toEqual([
      "rename:table",
      "rename:column",
    ]);
  });

  it("marks drops and nullable-to-not-null changes destructive", () => {
    const before = schema(
      "Table users {\n id bigint [pk]\n email varchar\n}",
    );
    const after = schema(
      "Table users {\n id bigint [pk]\n email varchar [not null]\n}",
    );
    const changes = diffSchemas(before, after);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "modify",
      target: "column",
      destructive: true,
    });
  });

  it("ignores parser-generated ids when unrelated elements change order", () => {
    const before = schema(`
Table users {
  id bigint [pk]
  email varchar
  indexes {
    email [name: 'idx_users_email']
  }
}
Table posts {
  id bigint [pk]
  user_id bigint
}
Ref fk_posts_users: posts.user_id > users.id
`);
    const after = schema(`
Table audit_logs {
  id bigint [pk]
}
Table users {
  id bigint [pk]
  email varchar
  indexes {
    email [name: 'idx_users_email']
  }
}
Table posts {
  id bigint [pk]
  user_id bigint
}
Ref fk_posts_users: posts.user_id > users.id
`);

    const changes = diffSchemas(before, after);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({
      kind: "add",
      target: "table",
      path: "public.audit_logs",
    });
  });
});

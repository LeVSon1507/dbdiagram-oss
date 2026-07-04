import { describe, expect, it } from "vitest";

import { generatePostgresMigration } from "./postgres-migration";
import { parseDbml } from "./schema";
import { diffSchemas } from "./schema-diff";

function schema(source: string) {
  const result = parseDbml(source);
  if (!result.ok) throw new Error(result.error.message);
  return result.schema;
}

describe("PostgreSQL migration generator", () => {
  it("orders foreign key drops before destructive column and table changes", () => {
    const before = schema(`
Table users {
  id bigint [pk]
}
Table posts {
  id bigint [pk]
  user_id bigint
}
Ref fk_posts_users: posts.user_id > users.id
`);
    const after = schema(`
Table posts {
  id bigint [pk]
}
`);

    const plan = generatePostgresMigration(diffSchemas(before, after));

    expect(plan.statements.map((item) => item.sql)).toEqual([
      'ALTER TABLE "public"."posts" DROP CONSTRAINT IF EXISTS "fk_posts_users";',
      'ALTER TABLE "public"."posts" DROP COLUMN "user_id";',
      'DROP TABLE "public"."users";',
    ]);
    expect(plan.hasDestructive).toBe(true);
  });

  it("generates create table, index, check, and relationship SQL", () => {
    const before = schema("");
    const after = schema(`
Table users {
  id bigint [pk, increment]
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
  user_id bigint [not null]
}
Ref fk_posts_users: posts.user_id > users.id [delete: cascade]
`);

    const plan = generatePostgresMigration(diffSchemas(before, after));

    expect(plan.sql).toContain('CREATE TABLE "public"."users"');
    expect(plan.sql).toContain('"id" bigserial PRIMARY KEY');
    expect(plan.sql).toContain('CREATE INDEX "idx_users_email"');
    expect(plan.sql).toContain('CONSTRAINT "age_positive" CHECK (age >= 0)');
    expect(plan.sql).toContain(
      'ADD CONSTRAINT "fk_posts_users" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE CASCADE;',
    );
    expect(plan.hasDestructive).toBe(false);
  });

  it("generates explicit table and column renames", () => {
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

    const plan = generatePostgresMigration(changes);

    expect(plan.statements.map((item) => item.sql)).toEqual([
      'ALTER TABLE "public"."users" RENAME TO "accounts";',
      'ALTER TABLE "public"."accounts" RENAME COLUMN "name" TO "display_name";',
    ]);
    expect(plan.hasDestructive).toBe(true);
  });

  it("flags type narrowing and NOT NULL while allowing known widening", () => {
    const before = schema(
      "Table users {\n id bigint [pk]\n code varchar(255)\n count integer\n}",
    );
    const after = schema(
      "Table users {\n id bigint [pk]\n code varchar(50) [not null]\n count bigint\n}",
    );

    const plan = generatePostgresMigration(diffSchemas(before, after));
    const typeStatements = plan.statements.filter((item) =>
      item.sql.includes(" TYPE "),
    );

    expect(typeStatements).toHaveLength(2);
    expect(typeStatements.find((item) => item.sql.includes("varchar(50)")))
      .toMatchObject({ destructive: true });
    expect(typeStatements.find((item) => item.sql.includes("bigint")))
      .toMatchObject({ destructive: false });
    expect(plan.hasDestructive).toBe(true);
  });
});

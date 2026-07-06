import { describe, expect, it } from "vitest";

import { updateDbmlFieldType } from "./dbml-source-edit";

const source = `Table users {
  id bigint [pk, increment]
  status varchar(40) [not null, default: 'active']
}

Table audit.users {
  id integer [pk]
  status text
  indexes {
    status
  }
}
`;

describe("updateDbmlFieldType", () => {
  it("updates only the requested field and preserves its settings", () => {
    const updated = updateDbmlFieldType(
      source,
      "public.users",
      "status",
      "text",
    );

    expect(updated).toContain(
      "status text [not null, default: 'active']",
    );
    expect(updated).toContain("Table audit.users {\n  id integer [pk]");
  });

  it("supports schema-qualified tables and fields with parameterized types", () => {
    const updated = updateDbmlFieldType(
      source,
      "audit.users",
      "id",
      "decimal(12,2)",
    );

    expect(updated).toContain(
      "Table audit.users {\n  id decimal(12,2) [pk]",
    );
    expect(updated).toContain("Table users {\n  id bigint [pk, increment]");
  });

  it("returns the source unchanged when the table or field is missing", () => {
    expect(
      updateDbmlFieldType(source, "public.accounts", "id", "uuid"),
    ).toBe(source);
    expect(
      updateDbmlFieldType(source, "public.users", "missing", "uuid"),
    ).toBe(source);
  });
});

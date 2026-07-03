import { describe, expect, it } from "vitest";

import { dbmlCompletionOptions } from "./dbml-language";

describe("dbmlCompletionOptions", () => {
  it("includes snippets, data types, and tables from the current document", () => {
    const labels = dbmlCompletionOptions(
      "Table users {\n id bigint [pk]\n}\nTable posts {}",
    ).map((completion) => completion.label);

    expect(labels).toContain("Table");
    expect(labels).toContain("Ref");
    expect(labels).toContain("varchar");
    expect(labels).toContain("users");
    expect(labels).toContain("posts");
  });
});

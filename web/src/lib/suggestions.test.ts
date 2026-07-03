import { describe, expect, it } from "vitest";

import type { ParsedSchema } from "./schema";
import { analyzeSchema } from "./suggestions";

describe("analyzeSchema", () => {
  it("identifies missing primary keys and likely unlinked foreign keys", () => {
    const schema: ParsedSchema = {
      tables: [
        {
          id: "public.posts",
          name: "posts",
          schemaName: "public",
          color: "#7c3aed",
          fields: [
            {
              id: "1",
              name: "author_id",
              type: "bigint",
              primaryKey: false,
              unique: false,
              nullable: false,
              increment: false,
            },
          ],
        },
      ],
      relations: [],
    };

    expect(analyzeSchema(schema).map((insight) => insight.id)).toEqual([
      "missing-pk-public.posts",
      "orphan-fk-public.posts-1",
    ]);
  });

  it("returns a healthy state for a consistent schema", () => {
    const schema: ParsedSchema = {
      tables: [
        {
          id: "public.users",
          name: "users",
          schemaName: "public",
          color: "#7c3aed",
          fields: [
            {
              id: "1",
              name: "id",
              type: "bigint",
              primaryKey: true,
              unique: false,
              nullable: false,
              increment: true,
            },
          ],
        },
      ],
      relations: [],
    };

    expect(analyzeSchema(schema)[0]).toMatchObject({
      id: "healthy-schema",
      severity: "success",
    });
  });
});

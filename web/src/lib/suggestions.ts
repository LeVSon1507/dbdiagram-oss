import type { ParsedSchema } from "./schema";

export type InsightSeverity = "warning" | "info" | "success";

export interface SchemaInsight {
  id: string;
  severity: InsightSeverity;
  title: string;
  description: string;
  aiPrompt: string;
}

export function analyzeSchema(schema: ParsedSchema): SchemaInsight[] {
  if (schema.tables.length === 0) {
    return [
      {
        id: "empty-schema",
        severity: "info",
        title: "Start with a domain description",
        description: "Ask AI to draft tables and relationships for your idea.",
        aiPrompt:
          "Generate a practical DBML schema from my description. Include primary keys, foreign keys, timestamps, and useful indexes.",
      },
    ];
  }

  const insights: SchemaInsight[] = [];
  const relatedFieldIds = new Set(
    schema.relations.flatMap((relation) => [
      relation.sourceFieldId,
      relation.targetFieldId,
    ]),
  );

  schema.tables.forEach((table) => {
    if (!table.fields.some((field) => field.primaryKey)) {
      insights.push({
        id: `missing-pk-${table.id}`,
        severity: "warning",
        title: `${table.name} has no primary key`,
        description: "A stable primary key improves references and migrations.",
        aiPrompt: `Add an appropriate primary key to the ${table.schemaName}.${table.name} table and preserve the rest of the schema.`,
      });
    }

    table.fields.forEach((field) => {
      if (field.name.endsWith("_id") && !relatedFieldIds.has(field.id)) {
        insights.push({
          id: `orphan-fk-${table.id}-${field.id}`,
          severity: "warning",
          title: `${table.name}.${field.name} looks unlinked`,
          description: "The field resembles a foreign key but has no Ref.",
          aiPrompt: `Review ${table.schemaName}.${table.name}.${field.name}. Add the most likely DBML Ref only if a matching table exists.`,
        });
      }
    });
  });

  schema.relations.forEach((relation) => {
    const table = schema.tables.find(
      (candidate) => candidate.id === relation.sourceTableId,
    );
    const field = table?.fields.find(
      (candidate) => candidate.id === relation.sourceFieldId,
    );
    if (table && field?.nullable) {
      insights.push({
        id: `nullable-fk-${relation.id}`,
        severity: "info",
        title: `${table.name}.${field.name} is an optional relation`,
        description: "Confirm that orphaned records are valid for this domain.",
        aiPrompt: `Review whether ${table.schemaName}.${table.name}.${field.name} should be nullable. Explain the tradeoff before changing it.`,
      });
    }
  });

  if (insights.length === 0) {
    insights.push({
      id: "healthy-schema",
      severity: "success",
      title: "Core structure looks consistent",
      description: "Every table has a primary key and likely foreign keys are linked.",
      aiPrompt:
        "Review this schema for normalization, indexing, naming, and data integrity risks. Do not change it unless necessary.",
    });
  }

  return insights.slice(0, 8);
}

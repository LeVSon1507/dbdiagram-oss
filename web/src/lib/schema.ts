import {
  CompilerError,
  Parser,
  type CompilerDiagnostic,
  type NormalizedModel,
  type NormalizedRef,
  type NormalizedTable,
} from "@dbml/core";

export interface SchemaField {
  id: string;
  name: string;
  type: string;
  primaryKey: boolean;
  unique: boolean;
  nullable: boolean;
  increment: boolean;
}

export interface SchemaTable {
  id: string;
  name: string;
  schemaName: string;
  color: string;
  fields: SchemaField[];
}

export interface SchemaRelation {
  id: string;
  sourceTableId: string;
  sourceFieldId: string;
  sourceCardinality: string;
  targetTableId: string;
  targetFieldId: string;
  targetCardinality: string;
}

export interface ParsedSchema {
  tables: SchemaTable[];
  relations: SchemaRelation[];
}

export interface SchemaError {
  message: string;
  line?: number;
  column?: number;
}

export type ParseResult =
  | { ok: true; schema: ParsedSchema }
  | { ok: false; error: SchemaError };

const DEFAULT_TABLE_COLOR = "#7c3aed";

function tableNodeId(schemaName: string, tableName: string): string {
  return `${schemaName}.${tableName}`;
}

function firstDiagnostic(error: unknown): CompilerDiagnostic | undefined {
  if (error instanceof CompilerError) {
    return error.diags[0];
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "diags" in error &&
    Array.isArray(error.diags)
  ) {
    const diagnostic = error.diags[0] as unknown;
    if (
      typeof diagnostic === "object" &&
      diagnostic !== null &&
      "message" in diagnostic &&
      typeof diagnostic.message === "string" &&
      "location" in diagnostic &&
      typeof diagnostic.location === "object" &&
      diagnostic.location !== null
    ) {
      return diagnostic as CompilerDiagnostic;
    }
  }

  return undefined;
}

function errorMessage(error: unknown): SchemaError {
  const diagnostic = firstDiagnostic(error);
  if (diagnostic) {
    return {
      message: diagnostic.message,
      line: diagnostic.location.start.line,
      column: diagnostic.location.start.column,
    };
  }

  return {
    message: error instanceof Error ? error.message : "Unable to parse DBML.",
  };
}

function toSchema(model: NormalizedModel): ParsedSchema {
  const schemasById = model.schemas;
  const tables = Object.values(model.tables).map(
    (table: NormalizedTable): SchemaTable => {
    const schemaName = schemasById[table.schemaId]?.name ?? "public";
    return {
      id: tableNodeId(schemaName, table.name),
      name: table.name,
      schemaName,
      color: table.headerColor ?? DEFAULT_TABLE_COLOR,
      fields: table.fieldIds.map((fieldId: number): SchemaField => {
        const field = model.fields[fieldId];
        const type = field.type.schemaName
          ? `${field.type.schemaName}.${field.type.type_name}`
          : field.type.type_name;

        return {
          id: String(field.id),
          name: field.name,
          type,
          primaryKey: field.pk,
          unique: field.unique,
          nullable: !field.not_null,
          increment: field.increment,
        };
      }),
    };
    },
  );

  const relations = Object.values(model.refs).flatMap(
    (reference: NormalizedRef): SchemaRelation[] => {
      const [sourceEndpoint, targetEndpoint] = reference.endpointIds.map(
        (endpointId: number) => model.endpoints[endpointId],
      );
      const sourceFieldId = sourceEndpoint?.fieldIds[0];
      const targetFieldId = targetEndpoint?.fieldIds[0];
      const sourceField =
        sourceFieldId === undefined ? undefined : model.fields[sourceFieldId];
      const targetField =
        targetFieldId === undefined ? undefined : model.fields[targetFieldId];
      const sourceTable =
        sourceField === undefined ? undefined : model.tables[sourceField.tableId];
      const targetTable =
        targetField === undefined ? undefined : model.tables[targetField.tableId];

      if (
        !sourceEndpoint ||
        !targetEndpoint ||
        !sourceField ||
        !targetField ||
        !sourceTable ||
        !targetTable
      ) {
        return [];
      }

      const sourceSchema = schemasById[sourceTable.schemaId]?.name ?? "public";
      const targetSchema = schemasById[targetTable.schemaId]?.name ?? "public";

      return [
        {
          id: `ref-${reference.id}`,
          sourceTableId: tableNodeId(sourceSchema, sourceTable.name),
          sourceFieldId: String(sourceField.id),
          sourceCardinality: sourceEndpoint.relation,
          targetTableId: tableNodeId(targetSchema, targetTable.name),
          targetFieldId: String(targetField.id),
          targetCardinality: targetEndpoint.relation,
        },
      ];
    },
  );

  return { tables, relations };
}

export function parseDbml(source: string): ParseResult {
  try {
    const parser = new Parser();
    const database = parser.parse(source, "dbmlv2");
    return { ok: true, schema: toSchema(database.normalize()) };
  } catch (error: unknown) {
    return { ok: false, error: errorMessage(error) };
  }
}

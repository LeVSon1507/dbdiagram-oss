import {
  CompilerError,
  Parser,
  type CompilerDiagnostic,
  type NormalizedCheck,
  type NormalizedIndex,
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
  defaultValue?: SchemaDefault;
  checks: SchemaCheck[];
}

export interface SchemaDefault {
  type: "number" | "string" | "boolean" | "expression";
  value: number | string | boolean;
}

export interface SchemaIndex {
  id: string;
  name?: string;
  type?: string;
  columns: {
    type: string;
    value: string;
  }[];
  unique: boolean;
  primaryKey: boolean;
}

export interface SchemaCheck {
  id: string;
  name?: string;
  expression: string;
  fieldName?: string;
}

export interface SchemaTable {
  id: string;
  name: string;
  schemaName: string;
  color: string;
  fields: SchemaField[];
  indexes: SchemaIndex[];
  checks: SchemaCheck[];
}

export interface SchemaRelation {
  id: string;
  sourceTableId: string;
  sourceFieldId: string;
  sourceCardinality: string;
  targetTableId: string;
  targetFieldId: string;
  targetCardinality: string;
  sourceFieldNames: string[];
  targetFieldNames: string[];
  name?: string;
  onDelete?: string;
  onUpdate?: string;
  foreignTableId?: string;
  foreignFieldNames: string[];
  referencedTableId?: string;
  referencedFieldNames: string[];
}

export interface ParsedSchema {
  tables: SchemaTable[];
  relations: SchemaRelation[];
}

export interface SchemaDiagnostic {
  message: string;
  severity: "error" | "warning" | "info";
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  code?: number;
}

export type SchemaError = SchemaDiagnostic;

export type ParseResult =
  | { ok: true; schema: ParsedSchema }
  | {
      ok: false;
      error: SchemaError;
      diagnostics: SchemaDiagnostic[];
    };

const DEFAULT_TABLE_COLOR = "#8e6a3f";

function tableNodeId(schemaName: string, tableName: string): string {
  return `${schemaName}.${tableName}`;
}

function compilerDiagnostics(error: unknown): CompilerDiagnostic[] {
  if (error instanceof CompilerError) {
    return error.diags;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "diags" in error &&
    Array.isArray(error.diags)
  ) {
    return error.diags.filter(
      (diagnostic: unknown): diagnostic is CompilerDiagnostic =>
        typeof diagnostic === "object" &&
        diagnostic !== null &&
        "message" in diagnostic &&
        typeof diagnostic.message === "string" &&
        "location" in diagnostic &&
        typeof diagnostic.location === "object" &&
        diagnostic.location !== null &&
        "start" in diagnostic.location &&
        typeof diagnostic.location.start === "object" &&
        diagnostic.location.start !== null &&
        "line" in diagnostic.location.start &&
        typeof diagnostic.location.start.line === "number" &&
        "column" in diagnostic.location.start &&
        typeof diagnostic.location.start.column === "number",
    );
  }

  return [];
}

function toSchemaDiagnostic(
  diagnostic: CompilerDiagnostic,
): SchemaDiagnostic {
  const { start, end } = diagnostic.location;
  return {
    message: diagnostic.message,
    severity:
      diagnostic.type === "warning" || diagnostic.type === "info"
        ? diagnostic.type
        : "error",
    line: start.line,
    column: start.column,
    endLine: end?.line ?? start.line,
    endColumn: end?.column ?? start.column + 1,
    code: diagnostic.code,
  };
}

function errorDiagnostics(error: unknown): SchemaDiagnostic[] {
  const diagnostics = compilerDiagnostics(error).map(toSchemaDiagnostic);
  if (diagnostics.length > 0) return diagnostics;

  return [
    {
      message: error instanceof Error ? error.message : "Unable to parse DBML.",
      severity: "error",
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 2,
    },
  ];
}

function toSchema(model: NormalizedModel): ParsedSchema {
  const schemasById = model.schemas;
  const toCheck = (check: NormalizedCheck): SchemaCheck => {
    const field =
      check.columnId === null || check.columnId === undefined
        ? undefined
        : model.fields[check.columnId];
    return {
      id: String(check.id),
      name: check.name || undefined,
      expression: check.expression,
      fieldName: field?.name,
    };
  };
  const toIndex = (index: NormalizedIndex): SchemaIndex => ({
    id: String(index.id),
    name: index.name ?? undefined,
    type: typeof index.type === "string" ? index.type : undefined,
    columns: index.columnIds.map((columnId) => {
      const column = model.indexColumns[columnId];
      return { type: column.type, value: column.value };
    }),
    unique: Boolean(index.unique),
    primaryKey: Boolean(index.pk),
  });
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
            primaryKey: Boolean(field.pk),
            unique: Boolean(field.unique),
            nullable: !field.not_null,
            increment: Boolean(field.increment),
            defaultValue: field.dbdefault
              ? {
                  type: field.dbdefault.type,
                  value: field.dbdefault.value,
                }
              : undefined,
            checks: field.checkIds.map((checkId) =>
              toCheck(model.checks[checkId]),
            ),
          };
        }),
        indexes: table.indexIds.map((indexId) =>
          toIndex(model.indexes[indexId]),
        ),
        checks: table.checkIds.map((checkId) =>
          toCheck(model.checks[checkId]),
        ),
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
      const sourceTableId = tableNodeId(sourceSchema, sourceTable.name);
      const targetTableId = tableNodeId(targetSchema, targetTable.name);
      const sourceIsForeign =
        sourceEndpoint.relation === "*" ||
        (sourceEndpoint.relation === targetEndpoint.relation &&
          sourceEndpoint.relation !== "*");
      const targetIsForeign =
        targetEndpoint.relation === "*" && sourceEndpoint.relation !== "*";

      return [
        {
          id: `ref-${reference.id}`,
          sourceTableId,
          sourceFieldId: String(sourceField.id),
          sourceCardinality: sourceEndpoint.relation,
          targetTableId,
          targetFieldId: String(targetField.id),
          targetCardinality: targetEndpoint.relation,
          sourceFieldNames: sourceEndpoint.fieldNames,
          targetFieldNames: targetEndpoint.fieldNames,
          name: reference.name ?? undefined,
          onDelete: reference.onDelete,
          onUpdate: reference.onUpdate,
          foreignTableId: sourceIsForeign
            ? sourceTableId
            : targetIsForeign
              ? targetTableId
              : undefined,
          foreignFieldNames: sourceIsForeign
            ? sourceEndpoint.fieldNames
            : targetIsForeign
              ? targetEndpoint.fieldNames
              : [],
          referencedTableId: sourceIsForeign
            ? targetTableId
            : targetIsForeign
              ? sourceTableId
              : undefined,
          referencedFieldNames: sourceIsForeign
            ? targetEndpoint.fieldNames
            : targetIsForeign
              ? sourceEndpoint.fieldNames
              : [],
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
    const diagnostics = errorDiagnostics(error);
    return { ok: false, error: diagnostics[0], diagnostics };
  }
}

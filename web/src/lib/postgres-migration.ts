import type {
  SchemaCheck,
  SchemaDefault,
  SchemaField,
  SchemaIndex,
  SchemaRelation,
  SchemaTable,
} from "./schema";
import type { SchemaChange } from "./schema-diff";

export interface MigrationStatement {
  changeId: string;
  sql: string;
  description: string;
  destructive: boolean;
}

export interface MigrationPlan {
  statements: MigrationStatement[];
  warnings: string[];
  sql: string;
  hasDestructive: boolean;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function quoteTable(tableId: string): string {
  return tableId.split(".").map(quoteIdentifier).join(".");
}

function tableName(tableId: string): string {
  return tableId.split(".").at(-1) ?? tableId;
}

function quoteIndex(tableId: string, name: string): string {
  const parts = tableId.split(".");
  const schema = parts.length > 1 ? parts.slice(0, -1) : [];
  return [...schema, name].map(quoteIdentifier).join(".");
}

function fieldType(field: SchemaField): string {
  if (!field.increment) return field.type;
  if (field.type.toLowerCase() === "bigint") return "bigserial";
  if (["int", "integer"].includes(field.type.toLowerCase())) return "serial";
  return field.type;
}

function defaultSql(value: SchemaDefault): string {
  if (value.type === "string") {
    return `'${String(value.value).replaceAll("'", "''")}'`;
  }
  if (value.type === "boolean") {
    return value.value ? "TRUE" : "FALSE";
  }
  return String(value.value);
}

function columnDefinition(field: SchemaField): string {
  const settings = [
    quoteIdentifier(field.name),
    fieldType(field),
    field.defaultValue ? `DEFAULT ${defaultSql(field.defaultValue)}` : "",
    field.nullable ? "" : "NOT NULL",
    field.unique ? "UNIQUE" : "",
    field.primaryKey ? "PRIMARY KEY" : "",
  ].filter(Boolean);
  return settings.join(" ");
}

function generatedName(prefix: string, ...parts: string[]): string {
  return [prefix, ...parts]
    .join("_")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
}

function indexName(tableId: string, index: SchemaIndex): string {
  return (
    index.name ??
    generatedName(
      index.primaryKey ? "pk" : "idx",
      tableName(tableId),
      ...index.columns.map((column) => column.value),
    )
  );
}

function indexColumns(index: SchemaIndex): string {
  return index.columns
    .map((column) =>
      column.type === "expression"
        ? `(${column.value})`
        : quoteIdentifier(column.value),
    )
    .join(", ");
}

function createIndexSql(tableId: string, index: SchemaIndex): string {
  if (index.primaryKey) {
    return `ALTER TABLE ${quoteTable(tableId)} ADD CONSTRAINT ${quoteIdentifier(
      indexName(tableId, index),
    )} PRIMARY KEY (${indexColumns(index)});`;
  }
  return `CREATE ${index.unique ? "UNIQUE " : ""}INDEX ${quoteIdentifier(
    indexName(tableId, index),
  )} ON ${quoteTable(tableId)}${
    index.type ? ` USING ${index.type}` : ""
  } (${indexColumns(index)});`;
}

function checkName(tableId: string, check: SchemaCheck): string {
  return (
    check.name ??
    generatedName(
      "chk",
      tableName(tableId),
      check.fieldName ?? "table",
      String(check.expression.length),
    )
  );
}

function createCheckSql(tableId: string, check: SchemaCheck): string {
  return `ALTER TABLE ${quoteTable(tableId)} ADD CONSTRAINT ${quoteIdentifier(
    checkName(tableId, check),
  )} CHECK (${check.expression});`;
}

function relationName(relation: SchemaRelation): string {
  return (
    relation.name ??
    generatedName(
      "fk",
      relation.foreignTableId
        ? tableName(relation.foreignTableId)
        : "relationship",
      ...relation.foreignFieldNames,
    )
  );
}

function relationAction(action: string | undefined): string {
  if (!action) return "";
  return action.replaceAll("_", " ").toUpperCase();
}

function addRelationSql(relation: SchemaRelation): string | undefined {
  if (!relation.foreignTableId || !relation.referencedTableId) {
    return undefined;
  }
  const foreignFields = relation.foreignFieldNames
    .map(quoteIdentifier)
    .join(", ");
  const referencedFields = relation.referencedFieldNames
    .map(quoteIdentifier)
    .join(", ");
  return `ALTER TABLE ${quoteTable(
    relation.foreignTableId,
  )} ADD CONSTRAINT ${quoteIdentifier(
    relationName(relation),
  )} FOREIGN KEY (${foreignFields}) REFERENCES ${quoteTable(
    relation.referencedTableId,
  )} (${referencedFields})${
    relation.onDelete
      ? ` ON DELETE ${relationAction(relation.onDelete)}`
      : ""
  }${
    relation.onUpdate
      ? ` ON UPDATE ${relationAction(relation.onUpdate)}`
      : ""
  };`;
}

function dropRelationSql(relation: SchemaRelation): string | undefined {
  if (!relation.foreignTableId) return undefined;
  return `ALTER TABLE ${quoteTable(
    relation.foreignTableId,
  )} DROP CONSTRAINT IF EXISTS ${quoteIdentifier(relationName(relation))};`;
}

function isKnownWidening(before: string, after: string): boolean {
  const from = before.toLowerCase();
  const to = after.toLowerCase();
  const numericWidening = new Set([
    "smallint>integer",
    "smallint>int",
    "smallint>bigint",
    "integer>bigint",
    "int>bigint",
    "real>double precision",
  ]);
  if (numericWidening.has(`${from}>${to}`)) return true;

  const beforeVarchar = from.match(/^varchar\((\d+)\)$/);
  const afterVarchar = to.match(/^varchar\((\d+)\)$/);
  return Boolean(
    beforeVarchar &&
      afterVarchar &&
      Number(afterVarchar[1]) >= Number(beforeVarchar[1]),
  );
}

function statement(
  change: SchemaChange,
  sql: string,
  description = change.summary,
  destructive = change.destructive,
): MigrationStatement {
  return {
    changeId: change.id,
    sql,
    description,
    destructive,
  };
}

function tableStatements(change: SchemaChange): MigrationStatement[] {
  if (change.kind === "add") {
    const table = change.after as SchemaTable;
    const constraints = [
      ...table.indexes
        .filter((index) => index.primaryKey)
        .map(
          (index) =>
            `CONSTRAINT ${quoteIdentifier(
              indexName(table.id, index),
            )} PRIMARY KEY (${indexColumns(index)})`,
        ),
      ...table.checks.map(
        (check) =>
          `CONSTRAINT ${quoteIdentifier(
            checkName(table.id, check),
          )} CHECK (${check.expression})`,
      ),
      ...table.fields.flatMap((field) =>
        field.checks.map(
          (check) =>
            `CONSTRAINT ${quoteIdentifier(
              checkName(table.id, check),
            )} CHECK (${check.expression})`,
        ),
      ),
    ];
    const definitions = [
      ...table.fields.map(columnDefinition),
      ...constraints,
    ].join(",\n  ");
    const createTable = `CREATE TABLE ${quoteTable(table.id)} (\n  ${definitions}\n);`;
    return [
      ...(table.schemaName === "public"
        ? []
        : [
            statement(
              change,
              `CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(
                table.schemaName,
              )};`,
              `Create schema ${table.schemaName}`,
              false,
            ),
          ]),
      statement(change, createTable),
      ...table.indexes
        .filter((index) => !index.primaryKey)
        .map((index) =>
          statement(change, createIndexSql(table.id, index), `Create index`),
        ),
    ];
  }
  if (change.kind === "remove") {
    const table = change.before as SchemaTable;
    return [
      statement(change, `DROP TABLE ${quoteTable(table.id)};`, change.summary, true),
    ];
  }
  if (change.kind === "rename") {
    const before = change.before as SchemaTable;
    const after = change.after as SchemaTable;
    const statements: MigrationStatement[] = [];
    if (before.schemaName !== after.schemaName) {
      statements.push(
        statement(
          change,
          `ALTER TABLE ${quoteTable(before.id)} SET SCHEMA ${quoteIdentifier(
            after.schemaName,
          )};`,
          `Move table ${before.id} to schema ${after.schemaName}`,
          true,
        ),
      );
    }
    if (before.name !== after.name) {
      const currentId =
        before.schemaName === after.schemaName
          ? before.id
          : `${after.schemaName}.${before.name}`;
      statements.push(
        statement(
          change,
          `ALTER TABLE ${quoteTable(currentId)} RENAME TO ${quoteIdentifier(
            after.name,
          )};`,
          change.summary,
          true,
        ),
      );
    }
    return statements;
  }
  return [];
}

function columnStatements(change: SchemaChange): MigrationStatement[] {
  const tableId = change.tableId;
  if (!tableId) return [];
  if (change.kind === "add") {
    const field = change.after as SchemaField;
    return [
      statement(
        change,
        `ALTER TABLE ${quoteTable(tableId)} ADD COLUMN ${columnDefinition(
          field,
        )};`,
      ),
    ];
  }
  if (change.kind === "remove") {
    const field = change.before as SchemaField;
    return [
      statement(
        change,
        `ALTER TABLE ${quoteTable(tableId)} DROP COLUMN ${quoteIdentifier(
          field.name,
        )};`,
        change.summary,
        true,
      ),
    ];
  }
  if (change.kind === "rename") {
    const before = change.before as SchemaField;
    const after = change.after as SchemaField;
    return [
      statement(
        change,
        `ALTER TABLE ${quoteTable(tableId)} RENAME COLUMN ${quoteIdentifier(
          before.name,
        )} TO ${quoteIdentifier(after.name)};`,
        change.summary,
        true,
      ),
    ];
  }
  if (change.kind !== "modify") return [];

  const before = change.before as SchemaField;
  const after = change.after as SchemaField;
  const prefix = `ALTER TABLE ${quoteTable(tableId)} ALTER COLUMN ${quoteIdentifier(
    after.name,
  )}`;
  const statements: MigrationStatement[] = [];
  if (before.type !== after.type) {
    statements.push(
      statement(
        change,
        `${prefix} TYPE ${after.type} USING ${quoteIdentifier(
          after.name,
        )}::${after.type};`,
        `Change ${change.path} type from ${before.type} to ${after.type}`,
        !isKnownWidening(before.type, after.type),
      ),
    );
  }
  if (!equalDefaults(before.defaultValue, after.defaultValue)) {
    statements.push(
      statement(
        change,
        after.defaultValue
          ? `${prefix} SET DEFAULT ${defaultSql(after.defaultValue)};`
          : `${prefix} DROP DEFAULT;`,
        `Change default for ${change.path}`,
        false,
      ),
    );
  }
  if (before.nullable !== after.nullable) {
    statements.push(
      statement(
        change,
        `${prefix} ${after.nullable ? "DROP" : "SET"} NOT NULL;`,
        `Change nullability for ${change.path}`,
        !after.nullable,
      ),
    );
  }
  const constraintPrefix = generatedName(
    tableName(tableId),
    after.name,
  );
  if (before.unique !== after.unique) {
    statements.push(
      statement(
        change,
        after.unique
          ? `ALTER TABLE ${quoteTable(
              tableId,
            )} ADD CONSTRAINT ${quoteIdentifier(
              `${constraintPrefix}_key`,
            )} UNIQUE (${quoteIdentifier(after.name)});`
          : `ALTER TABLE ${quoteTable(
              tableId,
            )} DROP CONSTRAINT IF EXISTS ${quoteIdentifier(
              `${constraintPrefix}_key`,
            )};`,
        `Change uniqueness for ${change.path}`,
        !after.unique,
      ),
    );
  }
  if (before.primaryKey !== after.primaryKey) {
    statements.push(
      statement(
        change,
        after.primaryKey
          ? `ALTER TABLE ${quoteTable(
              tableId,
            )} ADD CONSTRAINT ${quoteIdentifier(
              `${tableName(tableId)}_pkey`,
            )} PRIMARY KEY (${quoteIdentifier(after.name)});`
          : `ALTER TABLE ${quoteTable(
              tableId,
            )} DROP CONSTRAINT IF EXISTS ${quoteIdentifier(
              `${tableName(tableId)}_pkey`,
            )};`,
        `Change primary key for ${change.path}`,
        !after.primaryKey,
      ),
    );
  }
  return statements;
}

function equalDefaults(
  left: SchemaDefault | undefined,
  right: SchemaDefault | undefined,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function indexStatements(change: SchemaChange): MigrationStatement[] {
  if (!change.tableId) return [];
  const before = change.before as SchemaIndex | undefined;
  const after = change.after as SchemaIndex | undefined;
  const statements: MigrationStatement[] = [];
  if (before) {
    statements.push(
      statement(
        change,
        before.primaryKey
          ? `ALTER TABLE ${quoteTable(
              change.tableId,
            )} DROP CONSTRAINT IF EXISTS ${quoteIdentifier(
              indexName(change.tableId, before),
            )};`
          : `DROP INDEX IF EXISTS ${quoteIndex(
              change.tableId,
              indexName(change.tableId, before),
            )};`,
        `Drop index ${indexName(change.tableId, before)}`,
        true,
      ),
    );
  }
  if (after) {
    statements.push(
      statement(
        change,
        createIndexSql(change.tableId, after),
        `Create index ${indexName(change.tableId, after)}`,
        false,
      ),
    );
  }
  return statements;
}

function checkStatements(change: SchemaChange): MigrationStatement[] {
  if (!change.tableId) return [];
  const before = change.before as SchemaCheck | undefined;
  const after = change.after as SchemaCheck | undefined;
  const statements: MigrationStatement[] = [];
  if (before) {
    statements.push(
      statement(
        change,
        `ALTER TABLE ${quoteTable(
          change.tableId,
        )} DROP CONSTRAINT IF EXISTS ${quoteIdentifier(
          checkName(change.tableId, before),
        )};`,
        `Drop check ${checkName(change.tableId, before)}`,
        true,
      ),
    );
  }
  if (after) {
    statements.push(
      statement(
        change,
        createCheckSql(change.tableId, after),
        `Create check ${checkName(change.tableId, after)}`,
        false,
      ),
    );
  }
  return statements;
}

function relationshipStatements(
  change: SchemaChange,
  warnings: string[],
): MigrationStatement[] {
  const before = change.before as SchemaRelation | undefined;
  const after = change.after as SchemaRelation | undefined;
  const statements: MigrationStatement[] = [];
  if (before) {
    const sql = dropRelationSql(before);
    if (sql) {
      statements.push(statement(change, sql, `Drop relationship`, true));
    }
  }
  if (after) {
    const sql = addRelationSql(after);
    if (sql) {
      statements.push(statement(change, sql, `Create relationship`, false));
    } else {
      warnings.push(
        `Relationship ${change.path} is many-to-many and requires an explicit junction table.`,
      );
    }
  }
  return statements;
}

function priority(change: SchemaChange): number {
  if (change.target === "relationship" && change.kind !== "add") return 0;
  if (
    (change.target === "index" || change.target === "check") &&
    change.kind !== "add"
  ) {
    return 1;
  }
  if (change.target === "table" && change.kind === "rename") return 2;
  if (change.target === "table" && change.kind === "add") return 3;
  if (change.target === "column" && change.kind === "rename") return 4;
  if (change.target === "column" && change.kind !== "remove") return 5;
  if (change.target === "index" || change.target === "check") return 6;
  if (change.target === "relationship") return 7;
  if (change.target === "column" && change.kind === "remove") return 8;
  return 9;
}

export function generatePostgresMigration(
  changes: SchemaChange[],
): MigrationPlan {
  const warnings: string[] = [];
  const statements = [...changes]
    .sort((left, right) => priority(left) - priority(right))
    .flatMap((change): MigrationStatement[] => {
      switch (change.target) {
        case "table":
          return tableStatements(change);
        case "column":
          return columnStatements(change);
        case "index":
          return indexStatements(change);
        case "check":
          return checkStatements(change);
        case "relationship":
          return relationshipStatements(change, warnings);
      }
    });
  const destructiveStatements = statements.filter(
    (item) => item.destructive,
  );
  if (destructiveStatements.length > 0) {
    warnings.unshift(
      `${destructiveStatements.length} statement(s) may destroy or invalidate data.`,
    );
  }
  return {
    statements,
    warnings,
    sql: statements.map((item) => item.sql).join("\n\n"),
    hasDestructive: destructiveStatements.length > 0,
  };
}

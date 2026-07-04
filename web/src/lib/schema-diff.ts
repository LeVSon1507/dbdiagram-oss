import type {
  ParsedSchema,
  SchemaCheck,
  SchemaField,
  SchemaIndex,
  SchemaRelation,
  SchemaTable,
} from "./schema";

export type SchemaChangeTarget =
  | "table"
  | "column"
  | "index"
  | "check"
  | "relationship";
export type SchemaChangeKind = "add" | "remove" | "modify" | "rename";
export type SchemaEntity =
  | SchemaTable
  | SchemaField
  | SchemaIndex
  | SchemaCheck
  | SchemaRelation;

export interface SchemaChange {
  id: string;
  kind: SchemaChangeKind;
  target: SchemaChangeTarget;
  path: string;
  tableId?: string;
  before?: SchemaEntity;
  after?: SchemaEntity;
  destructive: boolean;
  summary: string;
}

export interface RenameMapping {
  target: "table" | "column";
  from: string;
  to: string;
}

function equal(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function changeId(
  kind: SchemaChangeKind,
  target: SchemaChangeTarget,
  path: string,
): string {
  return `${kind}-${target}-${path}`;
}

function indexKey(index: SchemaIndex): string {
  return (
    index.name ??
    `${index.columns.map((column) => `${column.type}:${column.value}`).join(",")}:${
      index.unique
    }:${index.primaryKey}`
  );
}

function checkKey(check: SchemaCheck): string {
  return check.name ?? `${check.fieldName ?? "table"}:${check.expression}`;
}

function relationKey(relation: SchemaRelation): string {
  return (
    relation.name ??
    `${relation.sourceTableId}.${relation.sourceFieldNames.join(",")}-${
      relation.targetTableId
    }.${relation.targetFieldNames.join(",")}`
  );
}

function entityComparable(
  target: Exclude<SchemaChangeTarget, "table" | "column">,
  entity: SchemaEntity,
): unknown {
  if (target === "index") {
    const index = entity as SchemaIndex;
    return {
      name: index.name,
      type: index.type,
      columns: index.columns,
      unique: index.unique,
      primaryKey: index.primaryKey,
    };
  }
  if (target === "check") {
    const check = entity as SchemaCheck;
    return {
      name: check.name,
      expression: check.expression,
      fieldName: check.fieldName,
    };
  }
  const relation = entity as SchemaRelation;
  return {
    name: relation.name,
    sourceTableId: relation.sourceTableId,
    sourceFieldNames: relation.sourceFieldNames,
    sourceCardinality: relation.sourceCardinality,
    targetTableId: relation.targetTableId,
    targetFieldNames: relation.targetFieldNames,
    targetCardinality: relation.targetCardinality,
    onDelete: relation.onDelete,
    onUpdate: relation.onUpdate,
  };
}

function compareNamedEntities<T extends SchemaEntity>(
  before: T[],
  after: T[],
  target: Exclude<SchemaChangeTarget, "table" | "column">,
  tableId: string | undefined,
  key: (entity: T) => string,
): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const beforeMap = new Map(before.map((entity) => [key(entity), entity]));
  const afterMap = new Map(after.map((entity) => [key(entity), entity]));

  beforeMap.forEach((entity, entityKey) => {
    const next = afterMap.get(entityKey);
    const path = tableId ? `${tableId}.${entityKey}` : entityKey;
    if (!next) {
      changes.push({
        id: changeId("remove", target, path),
        kind: "remove",
        target,
        path,
        tableId,
        before: entity,
        destructive: true,
        summary: `Remove ${target} ${entityKey}`,
      });
    } else if (
      !equal(entityComparable(target, entity), entityComparable(target, next))
    ) {
      changes.push({
        id: changeId("modify", target, path),
        kind: "modify",
        target,
        path,
        tableId,
        before: entity,
        after: next,
        destructive: target !== "relationship",
        summary: `Change ${target} ${entityKey}`,
      });
    }
  });

  afterMap.forEach((entity, entityKey) => {
    if (beforeMap.has(entityKey)) return;
    const path = tableId ? `${tableId}.${entityKey}` : entityKey;
    changes.push({
      id: changeId("add", target, path),
      kind: "add",
      target,
      path,
      tableId,
      after: entity,
      destructive: false,
      summary: `Add ${target} ${entityKey}`,
    });
  });

  return changes;
}

function fieldComparable(field: SchemaField) {
  return {
    type: field.type,
    primaryKey: field.primaryKey,
    unique: field.unique,
    nullable: field.nullable,
    increment: field.increment,
    defaultValue: field.defaultValue,
  };
}

function allChecks(table: SchemaTable): SchemaCheck[] {
  return [...table.checks, ...table.fields.flatMap((field) => field.checks)];
}

function fieldRenameMap(
  mappings: RenameMapping[],
  beforeTableId: string,
  afterTableId: string,
): Map<string, string> {
  return new Map(
    mappings
      .filter(
        (mapping) =>
          mapping.target === "column" &&
          mapping.from.startsWith(`${beforeTableId}.`) &&
          mapping.to.startsWith(`${afterTableId}.`),
      )
      .map((mapping) => [
        mapping.from.slice(beforeTableId.length + 1),
        mapping.to.slice(afterTableId.length + 1),
      ]),
  );
}

function compareTables(
  before: SchemaTable,
  after: SchemaTable,
  mappings: RenameMapping[],
): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const renameMap = fieldRenameMap(mappings, before.id, after.id);
  const afterFields = new Map(after.fields.map((field) => [field.name, field]));
  const matchedAfterFields = new Set<string>();

  before.fields.forEach((field) => {
    const nextName = renameMap.get(field.name) ?? field.name;
    const next = afterFields.get(nextName);
    const path = `${after.id}.${nextName}`;
    if (!next) {
      changes.push({
        id: changeId("remove", "column", `${before.id}.${field.name}`),
        kind: "remove",
        target: "column",
        path: `${before.id}.${field.name}`,
        tableId: before.id,
        before: field,
        destructive: true,
        summary: `Remove column ${before.id}.${field.name}`,
      });
      return;
    }

    matchedAfterFields.add(next.name);
    if (field.name !== next.name) {
      changes.push({
        id: changeId("rename", "column", path),
        kind: "rename",
        target: "column",
        path,
        tableId: after.id,
        before: field,
        after: next,
        destructive: true,
        summary: `Rename column ${field.name} to ${next.name}`,
      });
    }
    if (!equal(fieldComparable(field), fieldComparable(next))) {
      changes.push({
        id: changeId("modify", "column", path),
        kind: "modify",
        target: "column",
        path,
        tableId: after.id,
        before: field,
        after: next,
        destructive:
          field.type !== next.type ||
          (field.nullable && !next.nullable) ||
          (field.primaryKey && !next.primaryKey),
        summary: `Change column ${path}`,
      });
    }
  });

  after.fields.forEach((field) => {
    if (matchedAfterFields.has(field.name)) return;
    changes.push({
      id: changeId("add", "column", `${after.id}.${field.name}`),
      kind: "add",
      target: "column",
      path: `${after.id}.${field.name}`,
      tableId: after.id,
      after: field,
      destructive: !field.nullable && field.defaultValue === undefined,
      summary: `Add column ${after.id}.${field.name}`,
    });
  });

  changes.push(
    ...compareNamedEntities(
      before.indexes,
      after.indexes,
      "index",
      after.id,
      indexKey,
    ),
    ...compareNamedEntities(
      allChecks(before),
      allChecks(after),
      "check",
      after.id,
      checkKey,
    ),
  );
  return changes;
}

export function diffSchemas(
  before: ParsedSchema,
  after: ParsedSchema,
  mappings: RenameMapping[] = [],
): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const tableRenames = new Map(
    mappings
      .filter((mapping) => mapping.target === "table")
      .map((mapping) => [mapping.from, mapping.to]),
  );
  const afterTables = new Map(after.tables.map((table) => [table.id, table]));
  const matchedAfterTables = new Set<string>();

  before.tables.forEach((table) => {
    const nextId = tableRenames.get(table.id) ?? table.id;
    const next = afterTables.get(nextId);
    if (!next) {
      changes.push({
        id: changeId("remove", "table", table.id),
        kind: "remove",
        target: "table",
        path: table.id,
        before: table,
        destructive: true,
        summary: `Remove table ${table.id}`,
      });
      return;
    }

    matchedAfterTables.add(next.id);
    if (table.id !== next.id) {
      changes.push({
        id: changeId("rename", "table", next.id),
        kind: "rename",
        target: "table",
        path: next.id,
        before: table,
        after: next,
        destructive: true,
        summary: `Rename table ${table.id} to ${next.id}`,
      });
    }
    changes.push(...compareTables(table, next, mappings));
  });

  after.tables.forEach((table) => {
    if (matchedAfterTables.has(table.id)) return;
    changes.push({
      id: changeId("add", "table", table.id),
      kind: "add",
      target: "table",
      path: table.id,
      after: table,
      destructive: false,
      summary: `Add table ${table.id}`,
    });
  });

  changes.push(
    ...compareNamedEntities(
      before.relations,
      after.relations,
      "relationship",
      undefined,
      relationKey,
    ),
  );

  return changes;
}

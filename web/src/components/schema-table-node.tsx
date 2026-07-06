"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { KeyRound, Link2, Wrench } from "lucide-react";
import { memo, useState } from "react";

import { DBML_COLUMN_TYPES } from "@/lib/dbml-source-edit";
import type { SchemaTable } from "@/lib/schema";

export type SchemaTableNodeData = SchemaTable &
  Record<string, unknown> & {
    dimmed: boolean;
    foreignFieldNames: string[];
    onFieldTypeChange: (
      tableId: string,
      fieldName: string,
      nextType: string,
    ) => void;
  };

export type SchemaTableNode = Node<SchemaTableNodeData, "schemaTable">;

function SchemaTableNodeComponent({
  data,
  selected,
}: NodeProps<SchemaTableNode>) {
  const [editing, setEditing] = useState(false);
  const foreignFieldNameSet = new Set(data.foreignFieldNames);

  return (
    <article
      className={`schema-table ${selected ? "is-selected" : ""} ${
        data.dimmed ? "is-dimmed" : ""
      } ${editing ? "is-editing" : ""}`}
    >
      <header
        className="schema-table__header"
        style={{ "--table-color": data.color } as React.CSSProperties}
      >
        <span className="schema-table__schema">{data.schemaName}</span>
        <strong>{data.name}</strong>
        <span className="schema-table__count">{data.fields.length}</span>
        <button
          aria-label={`${editing ? "Finish editing" : "Edit"} ${data.name}`}
          aria-pressed={editing}
          className="nodrag nopan schema-table__edit"
          onClick={() => setEditing((current) => !current)}
          title={editing ? "Finish editing" : "Edit column types"}
          type="button"
        >
          <Wrench />
        </button>
      </header>
      <div className="schema-table__fields">
        {data.fields.map((field) => {
          const isForeignKeyField = foreignFieldNameSet.has(field.name);

          return (
            <div className="schema-field" key={field.id}>
              <Handle
                className="schema-field__handle"
                id={`target-${field.id}`}
                position={Position.Left}
                type="target"
              />
              <span className="schema-field__key">
                {field.primaryKey ? (
                  <KeyRound aria-label="Primary key" />
                ) : null}
              </span>
              <span className="schema-field__name">
                {field.name}
                {isForeignKeyField ? (
                  <Link2
                    aria-label="Foreign key"
                    className="schema-field__foreign"
                  />
                ) : null}
              </span>
              {editing ? (
                <select
                  aria-label={`Type for ${field.name}`}
                  className="nodrag nopan nowheel schema-field__type-select"
                  onChange={(event) =>
                    data.onFieldTypeChange(
                      data.id,
                      field.name,
                      event.target.value,
                    )
                  }
                  onPointerDown={(event) => event.stopPropagation()}
                  value={field.type}
                >
                  {DBML_COLUMN_TYPES.includes(
                    field.type as (typeof DBML_COLUMN_TYPES)[number],
                  ) ? null : <option value={field.type}>{field.type}</option>}
                  {DBML_COLUMN_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="schema-field__type">{field.type}</span>
              )}
              {field.nullable ? null : (
                <span className="schema-field__required" title="Not null">
                  N
                </span>
              )}
              <Handle
                className="schema-field__handle"
                id={`source-${field.id}`}
                position={Position.Right}
                type="source"
              />
            </div>
          );
        })}
      </div>
    </article>
  );
}

export const SchemaTableNodeView = memo(SchemaTableNodeComponent);

"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { KeyRound } from "lucide-react";
import { memo } from "react";

import type { SchemaTable } from "@/lib/schema";

export type SchemaTableNodeData = SchemaTable &
  Record<string, unknown> & {
    dimmed: boolean;
  };

export type SchemaTableNode = Node<SchemaTableNodeData, "schemaTable">;

function SchemaTableNodeComponent({
  data,
  selected,
}: NodeProps<SchemaTableNode>) {
  return (
    <article
      className={`schema-table ${selected ? "is-selected" : ""} ${
        data.dimmed ? "is-dimmed" : ""
      }`}
    >
      <header
        className="schema-table__header"
        style={{ "--table-color": data.color } as React.CSSProperties}
      >
        <span className="schema-table__schema">{data.schemaName}</span>
        <strong>{data.name}</strong>
        <span className="schema-table__count">{data.fields.length}</span>
      </header>
      <div className="schema-table__fields">
        {data.fields.map((field) => (
          <div className="schema-field" key={field.id}>
            <Handle
              className="schema-field__handle"
              id={`target-${field.id}`}
              position={Position.Left}
              type="target"
            />
            <span className="schema-field__key">
              {field.primaryKey ? <KeyRound aria-label="Primary key" /> : null}
            </span>
            <span className="schema-field__name">{field.name}</span>
            <span className="schema-field__type">{field.type}</span>
            {!field.nullable ? (
              <span className="schema-field__required" title="Not null">
                N
              </span>
            ) : null}
            <Handle
              className="schema-field__handle"
              id={`source-${field.id}`}
              position={Position.Right}
              type="source"
            />
          </div>
        ))}
      </div>
    </article>
  );
}

export const SchemaTableNodeView = memo(SchemaTableNodeComponent);

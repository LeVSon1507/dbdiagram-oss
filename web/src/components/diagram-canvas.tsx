"use client";

import dagre from "@dagrejs/dagre";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type NodeChange,
  type OnNodeDrag,
} from "@xyflow/react";
import { LayoutGrid, Maximize } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";

import type { ParsedSchema } from "@/lib/schema";
import type { Point, Theme } from "@/lib/workspace";

import { SchemaTableNodeView, type SchemaTableNode } from "./schema-table-node";
import {
  RelationshipEdgeView,
  type RelationshipEdge,
} from "./relationship-edge";

type DiagramCanvasProps = Readonly<{
  schema: ParsedSchema;
  positions: Record<string, Point>;
  search: string;
  theme: Theme;
  onPositionsChange: (positions: Record<string, Point>) => void;
}>;

const TABLE_WIDTH = 288;
const FIELD_HEIGHT = 34;
const HEADER_HEIGHT = 50;

const nodeTypes = {
  schemaTable: SchemaTableNodeView,
};

const edgeTypes = {
  relationship: RelationshipEdgeView,
};

function buildForeignFieldNamesByTable(
  schema: ParsedSchema,
): Map<string, Set<string>> {
  const foreignFieldNamesByTable = new Map<string, Set<string>>();

  schema.relations.forEach((relation) => {
    if (!relation.foreignTableId || relation.foreignFieldNames.length === 0) {
      return;
    }

    const existingFieldNames =
      foreignFieldNamesByTable.get(relation.foreignTableId) ??
      new Set<string>();
    relation.foreignFieldNames.forEach((fieldName) => {
      existingFieldNames.add(fieldName);
    });
    foreignFieldNamesByTable.set(relation.foreignTableId, existingFieldNames);
  });

  return foreignFieldNamesByTable;
}

function layoutNodes(
  schema: ParsedSchema,
  positions: Record<string, Point>,
  search: string,
): SchemaTableNode[] {
  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: "LR", nodesep: 70, ranksep: 130 });

  schema.tables.forEach((table) => {
    graph.setNode(table.id, {
      width: TABLE_WIDTH,
      height: HEADER_HEIGHT + table.fields.length * FIELD_HEIGHT,
    });
  });
  schema.relations.forEach((relation) => {
    graph.setEdge(relation.sourceTableId, relation.targetTableId);
  });
  dagre.layout(graph);

  const foreignFieldNamesByTable = buildForeignFieldNamesByTable(schema);
  const normalizedSearch = search.trim().toLocaleLowerCase();
  return schema.tables.map((table) => {
    const layout = graph.node(table.id) as { x: number; y: number };
    const height = HEADER_HEIGHT + table.fields.length * FIELD_HEIGHT;
    const position = positions[table.id] ?? {
      x: layout.x - TABLE_WIDTH / 2,
      y: layout.y - height / 2,
    };
    const searchableText = `${table.schemaName} ${table.name} ${table.fields
      .map((field) => field.name)
      .join(" ")}`.toLocaleLowerCase();

    return {
      id: table.id,
      type: "schemaTable",
      position,
      data: {
        ...table,
        foreignFieldNames: Array.from(
          foreignFieldNamesByTable.get(table.id) ?? new Set<string>(),
        ),
        dimmed:
          normalizedSearch.length > 0 &&
          !searchableText.includes(normalizedSearch),
      },
    };
  });
}

function toEdges(schema: ParsedSchema): RelationshipEdge[] {
  return schema.relations.map((relation) => ({
    id: relation.id,
    source: relation.sourceTableId,
    sourceHandle: `source-${relation.sourceFieldId}`,
    target: relation.targetTableId,
    targetHandle: `target-${relation.targetFieldId}`,
    type: "relationship",
    data: {
      sourceCardinality: relation.sourceCardinality,
      targetCardinality: relation.targetCardinality,
    },
  }));
}

function DiagramFlow({
  schema,
  positions,
  search,
  theme,
  onPositionsChange,
}: DiagramCanvasProps) {
  const initialNodes = useMemo(
    () => layoutNodes(schema, positions, search),
    [positions, schema, search],
  );
  const [nodes, setNodes, applyNodeChanges] =
    useNodesState<SchemaTableNode>(initialNodes);
  const [edges, setEdges, applyEdgeChanges] = useEdgesState<RelationshipEdge>(
    toEdges(schema),
  );
  const { fitView } = useReactFlow<SchemaTableNode, RelationshipEdge>();

  useEffect(() => {
    setNodes(layoutNodes(schema, positions, search));
    setEdges(toEdges(schema));
  }, [positions, schema, search, setEdges, setNodes]);

  const handleNodesChange = useCallback(
    (changes: NodeChange<SchemaTableNode>[]) => {
      applyNodeChanges(changes);
    },
    [applyNodeChanges],
  );

  const handleDragStop: OnNodeDrag<SchemaTableNode> = useCallback(
    (_event, node) => {
      onPositionsChange({
        ...positions,
        [node.id]: node.position,
      });
    },
    [onPositionsChange, positions],
  );

  const handleAutoLayout = useCallback(() => {
    const autoLayout = layoutNodes(schema, {}, search);
    setNodes(autoLayout);
    onPositionsChange(
      Object.fromEntries(autoLayout.map((node) => [node.id, node.position])),
    );
    globalThis.requestAnimationFrame(() => {
      void fitView({ duration: 300, padding: 0.16 });
    });
  }, [fitView, onPositionsChange, schema, search, setNodes]);

  return (
    <ReactFlow
      colorMode={theme}
      edges={edges}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.16 }}
      maxZoom={1.8}
      minZoom={0.15}
      nodes={nodes}
      nodeTypes={nodeTypes}
      onEdgesChange={applyEdgeChanges}
      onNodeDragStop={handleDragStop}
      onNodesChange={handleNodesChange}
      proOptions={{ hideAttribution: true }}
      snapGrid={[16, 16]}
      snapToGrid
    >
      <Background
        color={theme === "dark" ? "#4b3d30" : "#d8c7ab"}
        gap={24}
        size={1}
        variant={BackgroundVariant.Dots}
      />
      <MiniMap
        maskColor={
          theme === "dark"
            ? "rgba(22, 17, 13, .72)"
            : "rgba(248, 243, 234, .72)"
        }
        nodeColor="#b59265"
        pannable
        zoomable
      />
      <Controls position="bottom-right" showInteractive={false} />
      <Panel className="canvas-actions" position="bottom-center">
        <button onClick={handleAutoLayout} type="button">
          <LayoutGrid />
          Auto layout
        </button>
        <button
          onClick={() => void fitView({ duration: 300, padding: 0.16 })}
          type="button"
        >
          <Maximize />
          Fit view
        </button>
      </Panel>
    </ReactFlow>
  );
}

export function DiagramCanvas(props: DiagramCanvasProps) {
  return (
    <ReactFlowProvider>
      <DiagramFlow {...props} />
    </ReactFlowProvider>
  );
}

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
import { LayoutGrid, Map as MapIcon, Maximize } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

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

function buildLaidOutNodes(
  schema: ParsedSchema,
  positions: Record<string, Point>,
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
  return schema.tables.map((table) => {
    const layout = graph.node(table.id) as { x: number; y: number };
    const height = HEADER_HEIGHT + table.fields.length * FIELD_HEIGHT;
    const position = positions[table.id] ?? {
      x: layout.x - TABLE_WIDTH / 2,
      y: layout.y - height / 2,
    };

    return {
      id: table.id,
      type: "schemaTable",
      position,
      data: {
        ...table,
        foreignFieldNames: Array.from(
          foreignFieldNamesByTable.get(table.id) ?? new Set<string>(),
        ),
        dimmed: false,
      },
    };
  });
}

function applySearchToNodes(
  nodes: SchemaTableNode[],
  search: string,
): SchemaTableNode[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();

  if (normalizedSearch.length === 0) {
    return nodes.map((nodeValue) =>
      nodeValue.data.dimmed
        ? {
            ...nodeValue,
            data: {
              ...nodeValue.data,
              dimmed: false,
            },
          }
        : nodeValue,
    );
  }

  return nodes.map((nodeValue) => {
    const searchableText =
      `${nodeValue.data.schemaName} ${nodeValue.data.name} ${nodeValue.data.fields
        .map((field) => field.name)
        .join(" ")}`.toLocaleLowerCase();
    const dimmed = !searchableText.includes(normalizedSearch);

    if (nodeValue.data.dimmed === dimmed) {
      return nodeValue;
    }

    return {
      ...nodeValue,
      data: {
        ...nodeValue.data,
        dimmed,
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
  const [miniMapVisible, setMiniMapVisible] = useState(true);
  const laidOutNodes = useMemo(
    () => buildLaidOutNodes(schema, positions),
    [positions, schema],
  );
  const initialNodes = useMemo(
    () => applySearchToNodes(laidOutNodes, search),
    [laidOutNodes, search],
  );
  const [nodes, setNodes, applyNodeChanges] =
    useNodesState<SchemaTableNode>(initialNodes);
  const [edges, setEdges, applyEdgeChanges] = useEdgesState<RelationshipEdge>(
    toEdges(schema),
  );
  const { fitView } = useReactFlow<SchemaTableNode, RelationshipEdge>();

  useEffect(() => {
    setNodes(applySearchToNodes(laidOutNodes, search));
  }, [laidOutNodes, search, setNodes]);

  useEffect(() => {
    setEdges(toEdges(schema));
  }, [schema, setEdges]);

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
    const autoLayout = applySearchToNodes(
      buildLaidOutNodes(schema, {}),
      search,
    );
    setNodes(autoLayout);
    onPositionsChange(
      Object.fromEntries(autoLayout.map((node) => [node.id, node.position])),
    );
    globalThis.requestAnimationFrame(() => {
      void fitView({ duration: 300, padding: 0.16 });
    });
  }, [fitView, onPositionsChange, schema, search, setNodes]);

  const toggleMiniMapVisibility = useCallback(() => {
    setMiniMapVisible((currentVisible) => !currentVisible);
  }, []);

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
      {miniMapVisible ? (
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
      ) : null}
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
        <button onClick={toggleMiniMapVisibility} type="button">
          <MapIcon />
          {miniMapVisible ? "Hide minimap" : "Show minimap"}
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

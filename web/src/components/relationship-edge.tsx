"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { memo } from "react";

import {
  cardinalityLabel,
  relationshipLabel,
  type CardinalityLabel,
} from "@/lib/relationship";

export type RelationshipEdgeData = Record<string, unknown> & {
  sourceCardinality: string;
  targetCardinality: string;
};

export type RelationshipEdge = Edge<RelationshipEdgeData, "relationship">;

interface CardinalityMarkerProps {
  cardinality: CardinalityLabel;
  id: string;
  selected: boolean;
}

function CardinalityMarker({
  cardinality,
  id,
  selected,
}: CardinalityMarkerProps) {
  return (
    <marker
      id={id}
      markerHeight="20"
      markerUnits="userSpaceOnUse"
      markerWidth="22"
      orient="auto-start-reverse"
      refX="20"
      refY="0"
      viewBox="0 -10 22 20"
    >
      {cardinality === "1" ? (
        <path
          className={`relationship-marker ${selected ? "is-selected" : ""}`}
          d="M 9 -7 L 9 7 M 15 -7 L 15 7"
        />
      ) : (
        <path
          className={`relationship-marker ${selected ? "is-selected" : ""}`}
          d="M 6 -8 L 15 0 L 6 8 M 15 -8 L 15 8"
        />
      )}
    </marker>
  );
}

function RelationshipEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelationshipEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
    offset: 28,
  });
  const markerId = id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const sourceMarkerId = `${markerId}-source-cardinality`;
  const targetMarkerId = `${markerId}-target-cardinality`;
  const sourceCardinality = cardinalityLabel(
    data?.sourceCardinality ?? "N",
  );
  const targetCardinality = cardinalityLabel(
    data?.targetCardinality ?? "N",
  );

  return (
    <>
      <defs>
        <CardinalityMarker
          cardinality={sourceCardinality}
          id={sourceMarkerId}
          selected={Boolean(selected)}
        />
        <CardinalityMarker
          cardinality={targetCardinality}
          id={targetMarkerId}
          selected={Boolean(selected)}
        />
      </defs>
      <BaseEdge
        className={
          selected ? "relationship-edge is-selected" : "relationship-edge"
        }
        id={id}
        interactionWidth={24}
        markerEnd={`url(#${targetMarkerId})`}
        markerStart={`url(#${sourceMarkerId})`}
        path={path}
      />
      <EdgeLabelRenderer>
        <div
          className={`relationship-label ${selected ? "is-selected" : ""}`}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          }}
        >
          {relationshipLabel(sourceCardinality, targetCardinality)}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const RelationshipEdgeView = memo(RelationshipEdgeComponent);

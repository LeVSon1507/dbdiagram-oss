"use client";

import {
  Camera,
  GitCompareArrows,
  History,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import type { DiagramSnapshot } from "@/lib/workspace-repository";
import { IllustrationImage } from "./illustration-image";

type HistoryDrawerProps = Readonly<{
  open: boolean;
  snapshots: DiagramSnapshot[];
  onClose: () => void;
  onCompare: (snapshot: DiagramSnapshot) => void;
  onCreate: () => void;
  onDelete: (snapshotId: string) => void;
  onRename: (snapshotId: string, name: string) => void;
  onRestore: (snapshot: DiagramSnapshot) => void;
}>;

function reasonLabel(reason: DiagramSnapshot["reason"]): string {
  const labels: Record<DiagramSnapshot["reason"], string> = {
    manual: "Manual",
    auto: "Automatic",
    "before-ai": "Before AI",
    "before-import": "Before import",
    "before-restore": "Before restore",
  };
  return labels[reason];
}

export function HistoryDrawer({
  open,
  snapshots,
  onClose,
  onCompare,
  onCreate,
  onDelete,
  onRename,
  onRestore,
}: HistoryDrawerProps) {
  return (
    <aside
      aria-label="Version history"
      className={`history-drawer ${open ? "is-open" : ""}`}
    >
      <header className="history-drawer__header">
        <div>
          <History />
          <span>
            <strong>Version history</strong>
            <small>{snapshots.length} snapshots</small>
          </span>
        </div>
        <button
          aria-label="Close version history"
          className="icon-button"
          onClick={onClose}
          type="button"
        >
          <X />
        </button>
      </header>
      <div className="history-drawer__actions">
        <button onClick={onCreate} type="button">
          <Camera />
          Create snapshot
        </button>
      </div>
      <div className="snapshot-list">
        {snapshots.length === 0 ? (
          <div className="snapshot-empty">
            <IllustrationImage
              alt="No snapshots yet"
              className="snapshot-empty__illustration"
              height={160}
              illustration="serverStatus"
              width={220}
            />
            <strong>No snapshots yet</strong>
            <span>Create one before making a major schema change.</span>
          </div>
        ) : null}
        {snapshots.map((snapshot) => (
          <article className="snapshot-card" key={snapshot.id}>
            <header>
              <span>{reasonLabel(snapshot.reason)}</span>
              <time dateTime={snapshot.createdAt}>
                {new Date(snapshot.createdAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </header>
            <input
              aria-label="Snapshot name"
              defaultValue={snapshot.name}
              key={`${snapshot.id}-${snapshot.name}`}
              onBlur={(event) =>
                onRename(snapshot.id, event.currentTarget.value)
              }
            />
            <small>
              {snapshot.source.split("\n").length} lines ·{" "}
              {Object.keys(snapshot.positions).length} positioned tables
            </small>
            <footer>
              <button onClick={() => onCompare(snapshot)} type="button">
                <GitCompareArrows />
                Compare
              </button>
              <button onClick={() => onRestore(snapshot)} type="button">
                <RotateCcw />
                Restore
              </button>
              <button
                aria-label={`Delete ${snapshot.name}`}
                onClick={() => onDelete(snapshot.id)}
                type="button"
              >
                <Trash2 />
              </button>
            </footer>
          </article>
        ))}
      </div>
    </aside>
  );
}

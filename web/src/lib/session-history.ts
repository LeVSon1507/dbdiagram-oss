import type { DiagramDocument } from "./workspace";

export type HistoryReason =
  | "typing"
  | "drag"
  | "import"
  | "restore"
  | "ai"
  | "rename";

export interface HistoryEntry {
  document: DiagramDocument;
  reason: HistoryReason;
  createdAt: number;
}

export interface SessionHistory {
  past: HistoryEntry[];
  present: DiagramDocument;
  future: HistoryEntry[];
  lastReason?: HistoryReason;
  lastCommittedAt: number;
}

const MAX_HISTORY_ENTRIES = 100;
const TYPING_COALESCE_MS = 400;

export function createSessionHistory(
  document: DiagramDocument,
): SessionHistory {
  return {
    past: [],
    present: document,
    future: [],
    lastCommittedAt: 0,
  };
}

function documentsEqual(
  left: DiagramDocument,
  right: DiagramDocument,
): boolean {
  return (
    left.name === right.name &&
    left.source === right.source &&
    JSON.stringify(left.positions) === JSON.stringify(right.positions)
  );
}

export function commitHistory(
  history: SessionHistory,
  document: DiagramDocument,
  reason: HistoryReason,
  createdAt = Date.now(),
): SessionHistory {
  if (documentsEqual(history.present, document)) return history;

  const coalesceTyping =
    reason === "typing" &&
    history.lastReason === "typing" &&
    createdAt - history.lastCommittedAt <= TYPING_COALESCE_MS;

  return {
    past: coalesceTyping
      ? history.past
      : [
          ...history.past,
          {
            document: history.present,
            reason,
            createdAt,
          },
        ].slice(-MAX_HISTORY_ENTRIES),
    present: document,
    future: [],
    lastReason: reason,
    lastCommittedAt: createdAt,
  };
}

export function undoHistory(history: SessionHistory): SessionHistory {
  const previous = history.past.at(-1);
  if (!previous) return history;

  return {
    past: history.past.slice(0, -1),
    present: previous.document,
    future: [
      {
        document: history.present,
        reason: previous.reason,
        createdAt: Date.now(),
      },
      ...history.future,
    ],
    lastCommittedAt: 0,
  };
}

export function redoHistory(history: SessionHistory): SessionHistory {
  const next = history.future[0];
  if (!next) return history;

  return {
    past: [
      ...history.past,
      {
        document: history.present,
        reason: next.reason,
        createdAt: Date.now(),
      },
    ].slice(-MAX_HISTORY_ENTRIES),
    present: next.document,
    future: history.future.slice(1),
    lastCommittedAt: 0,
  };
}

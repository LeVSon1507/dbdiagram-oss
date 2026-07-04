import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import {
  createWorkspace,
  isWorkspace,
  LEGACY_STORAGE_KEY,
  readLegacyWorkspace,
  type DiagramDocument,
  type Point,
  type Workspace,
} from "./workspace";

export type SnapshotReason =
  | "manual"
  | "auto"
  | "before-ai"
  | "before-import"
  | "before-restore";

export interface DiagramSnapshot {
  id: string;
  documentId: string;
  documentName: string;
  name: string;
  source: string;
  positions: Record<string, Point>;
  reason: SnapshotReason;
  createdAt: string;
}

export interface WorkspaceRepository {
  initialize(legacyStorage?: Storage): Promise<Workspace>;
  saveWorkspace(workspace: Workspace): Promise<void>;
  listSnapshots(documentId: string): Promise<DiagramSnapshot[]>;
  createSnapshot(
    document: DiagramDocument,
    reason: SnapshotReason,
    name?: string,
  ): Promise<DiagramSnapshot>;
  renameSnapshot(snapshotId: string, name: string): Promise<void>;
  deleteSnapshot(snapshotId: string): Promise<void>;
  close(): void;
}

interface SchemaStudioDb extends DBSchema {
  workspace: {
    key: "current";
    value: Workspace;
  };
  snapshots: {
    key: string;
    value: DiagramSnapshot;
    indexes: {
      "by-document": string;
    };
  };
}

const DATABASE_NAME = "schema-studio";
const MAX_SNAPSHOTS_PER_DOCUMENT = 50;

function createId(): string {
  return globalThis.crypto?.randomUUID() ?? `snapshot-${Date.now()}`;
}

function defaultSnapshotName(reason: SnapshotReason): string {
  const names: Record<SnapshotReason, string> = {
    manual: "Manual snapshot",
    auto: "Automatic snapshot",
    "before-ai": "Before AI apply",
    "before-import": "Before import",
    "before-restore": "Before restore",
  };
  return names[reason];
}

async function openWorkspaceDb(
  databaseName: string,
): Promise<IDBPDatabase<SchemaStudioDb>> {
  return openDB<SchemaStudioDb>(databaseName, 1, {
    upgrade(database) {
      database.createObjectStore("workspace");
      const snapshots = database.createObjectStore("snapshots", {
        keyPath: "id",
      });
      snapshots.createIndex("by-document", "documentId");
    },
  });
}

class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  private database?: IDBPDatabase<SchemaStudioDb>;

  constructor(private readonly databaseName: string) {}

  private async db(): Promise<IDBPDatabase<SchemaStudioDb>> {
    this.database ??= await openWorkspaceDb(this.databaseName);
    return this.database;
  }

  async initialize(legacyStorage?: Storage): Promise<Workspace> {
    const database = await this.db();
    const stored: unknown = await database.get("workspace", "current");
    if (isWorkspace(stored)) return stored;

    const legacy = legacyStorage
      ? readLegacyWorkspace(legacyStorage)
      : undefined;
    const workspace = legacy ?? createWorkspace();
    await database.put("workspace", workspace, "current");
    if (legacy) legacyStorage?.removeItem(LEGACY_STORAGE_KEY);
    return workspace;
  }

  async saveWorkspace(workspace: Workspace): Promise<void> {
    const database = await this.db();
    await database.put("workspace", workspace, "current");
  }

  async listSnapshots(documentId: string): Promise<DiagramSnapshot[]> {
    const database = await this.db();
    const snapshots = await database.getAllFromIndex(
      "snapshots",
      "by-document",
      documentId,
    );
    return snapshots.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  async createSnapshot(
    document: DiagramDocument,
    reason: SnapshotReason,
    name = defaultSnapshotName(reason),
  ): Promise<DiagramSnapshot> {
    const snapshot: DiagramSnapshot = {
      id: createId(),
      documentId: document.id,
      documentName: document.name,
      name,
      source: document.source,
      positions: document.positions,
      reason,
      createdAt: new Date().toISOString(),
    };
    const database = await this.db();
    await database.put("snapshots", snapshot);

    const snapshots = await this.listSnapshots(document.id);
    const expired = snapshots.slice(MAX_SNAPSHOTS_PER_DOCUMENT);
    const transaction = database.transaction("snapshots", "readwrite");
    await Promise.all([
      ...expired.map((item) => transaction.store.delete(item.id)),
      transaction.done,
    ]);
    return snapshot;
  }

  async renameSnapshot(snapshotId: string, name: string): Promise<void> {
    const normalizedName = name.trim();
    if (!normalizedName) return;

    const database = await this.db();
    const snapshot = await database.get("snapshots", snapshotId);
    if (!snapshot) return;
    await database.put("snapshots", { ...snapshot, name: normalizedName });
  }

  async deleteSnapshot(snapshotId: string): Promise<void> {
    const database = await this.db();
    await database.delete("snapshots", snapshotId);
  }

  close(): void {
    this.database?.close();
    this.database = undefined;
  }
}

export function createWorkspaceRepository(
  databaseName = DATABASE_NAME,
): WorkspaceRepository {
  return new IndexedDbWorkspaceRepository(databaseName);
}

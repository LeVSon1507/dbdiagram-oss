import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import {
  LEGACY_STORAGE_KEY,
  type Workspace,
} from "./workspace";
import { createWorkspaceRepository } from "./workspace-repository";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const databaseNames: string[] = [];

function repository() {
  const name = `schema-studio-test-${crypto.randomUUID()}`;
  databaseNames.push(name);
  return createWorkspaceRepository(name);
}

afterEach(async () => {
  await Promise.all(
    databaseNames.splice(0).map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.deleteDatabase(name);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }),
    ),
  );
});

describe("workspace repository", () => {
  it("migrates the legacy localStorage workspace once", async () => {
    const storage = new MemoryStorage();
    const workspace: Workspace = {
      currentDocumentId: "one",
      theme: "light",
      documents: [
        {
          id: "one",
          name: "Example",
          source: "Table example { id int [pk] }",
          positions: { "public.example": { x: 10, y: 20 } },
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    storage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(workspace));
    const store = repository();

    expect(await store.initialize(storage)).toEqual(workspace);
    expect(storage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
    expect(await store.initialize(storage)).toEqual(workspace);
    store.close();
  });

  it("persists workspaces and restores them", async () => {
    const store = repository();
    const workspace = await store.initialize();
    const updated = { ...workspace, theme: "light" as const };

    await store.saveWorkspace(updated);

    expect(await store.initialize()).toEqual(updated);
    store.close();
  });

  it("keeps only the newest 50 snapshots for a diagram", async () => {
    const store = repository();
    const workspace = await store.initialize();
    const document = workspace.documents[0];

    for (let index = 0; index < 52; index += 1) {
      await store.createSnapshot(
        { ...document, source: `${document.source}\n// ${index}` },
        "auto",
        `Snapshot ${index}`,
      );
    }

    const snapshots = await store.listSnapshots(document.id);
    expect(snapshots).toHaveLength(50);
    expect(snapshots.some((item) => item.name === "Snapshot 0")).toBe(false);
    expect(snapshots.some((item) => item.name === "Snapshot 51")).toBe(true);
    store.close();
  });

  it("renames and deletes snapshots", async () => {
    const store = repository();
    const workspace = await store.initialize();
    const document = workspace.documents[0];
    const snapshot = await store.createSnapshot(document, "manual");

    await store.renameSnapshot(snapshot.id, "Release candidate");
    expect((await store.listSnapshots(document.id))[0].name).toBe(
      "Release candidate",
    );

    await store.deleteSnapshot(snapshot.id);
    expect(await store.listSnapshots(document.id)).toEqual([]);
    store.close();
  });
});

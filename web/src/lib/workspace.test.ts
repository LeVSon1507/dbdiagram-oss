import { describe, expect, it } from "vitest";

import { loadWorkspace, saveWorkspace, type Workspace } from "./workspace";

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

describe("workspace persistence", () => {
  it("round-trips a valid workspace", () => {
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

    saveWorkspace(storage, workspace);

    expect(loadWorkspace(storage)).toEqual(workspace);
  });

  it("recovers from malformed persisted data", () => {
    const storage = new MemoryStorage();
    storage.setItem("dbdiagram-local.workspace.v1", "{broken");

    const workspace = loadWorkspace(storage);

    expect(workspace.documents).toHaveLength(1);
    expect(workspace.currentDocumentId).toBe(workspace.documents[0].id);
  });
});

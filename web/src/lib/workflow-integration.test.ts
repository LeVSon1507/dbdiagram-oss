import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import {
  createAiProposal,
  resolveAiProposal,
  setProposalHunkAccepted,
} from "./ai-proposal";
import { generatePostgresMigration } from "./postgres-migration";
import { parseDbml } from "./schema";
import { diffSchemas } from "./schema-diff";
import {
  commitHistory,
  createSessionHistory,
  undoHistory,
} from "./session-history";
import type { DiagramDocument } from "./workspace";
import { createWorkspaceRepository } from "./workspace-repository";

const databaseNames: string[] = [];

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

function schema(source: string) {
  const result = parseDbml(source);
  if (!result.ok) throw new Error(result.error.message);
  return result.schema;
}

describe("safe workflow integration", () => {
  it("edits, snapshots, partially applies AI, generates migration, and restores", async () => {
    const databaseName = `workflow-${crypto.randomUUID()}`;
    databaseNames.push(databaseName);
    const repository = createWorkspaceRepository(databaseName);
    const baseline: DiagramDocument = {
      id: "diagram",
      name: "Accounts",
      source: `Table users {
  id bigint [pk]
  email varchar
}

Table audit_logs {
  id bigint [pk]
  message text
}
`,
      positions: { "public.users": { x: 10, y: 20 } },
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const snapshot = await repository.createSnapshot(
      baseline,
      "manual",
      "Baseline",
    );

    let history = createSessionHistory(baseline);
    const edited = {
      ...baseline,
      source: baseline.source.replace("email varchar", "email varchar(255)"),
    };
    history = commitHistory(history, edited, "typing", 1000);

    const proposedSource = `${edited.source.replace(
      "email varchar(255)",
      "email varchar(255) [not null, unique]",
    )}
Table sessions {
  id bigint [pk]
  user_id bigint [not null]
}
Ref: sessions.user_id > users.id
`;
    let proposal = createAiProposal(edited.source, proposedSource);
    expect(proposal.hunks.length).toBeGreaterThan(1);
    proposal = setProposalHunkAccepted(
      proposal,
      proposal.hunks.at(-1)?.id ?? "",
      false,
    );
    const acceptedSource = resolveAiProposal(proposal, edited.source);
    history = commitHistory(
      history,
      { ...edited, source: acceptedSource },
      "ai",
      2000,
    );

    const changes = diffSchemas(
      schema(snapshot.source),
      schema(history.present.source),
    );
    const migration = generatePostgresMigration(changes);
    expect(migration.sql).toContain("varchar(255)");
    expect(migration.sql).not.toContain("sessions");

    history = commitHistory(
      history,
      {
        ...history.present,
        source: snapshot.source,
        positions: snapshot.positions,
      },
      "restore",
      3000,
    );
    expect(history.present.source).toBe(baseline.source);
    expect(undoHistory(history).present.source).toBe(acceptedSource);
    expect(await repository.listSnapshots("diagram")).toHaveLength(1);
    repository.close();
  });
});

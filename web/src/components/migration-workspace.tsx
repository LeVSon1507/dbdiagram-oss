"use client";

import {
  AlertTriangle,
  Check,
  Clipboard,
  Download,
  GitCompareArrows,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { generatePostgresMigration } from "@/lib/postgres-migration";
import { parseDbml, type SchemaTable } from "@/lib/schema";
import {
  diffSchemas,
  type RenameMapping,
  type SchemaChange,
} from "@/lib/schema-diff";
import type { DiagramDocument } from "@/lib/workspace";
import type { DiagramSnapshot } from "@/lib/workspace-repository";

interface MigrationWorkspaceProps {
  current: DiagramDocument;
  snapshot: DiagramSnapshot;
  onClose: () => void;
  onRestore: (snapshot: DiagramSnapshot) => void;
}

interface RenameChoice {
  from: string;
  to: string;
}

function downloadSql(name: string, sql: string): void {
  const blob = new Blob([sql], { type: "text/sql;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${name.replace(/[^a-z0-9-_]+/gi, "-")}-migration.sql`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function removedTables(changes: SchemaChange[]): SchemaTable[] {
  return changes
    .filter(
      (change) => change.target === "table" && change.kind === "remove",
    )
    .map((change) => change.before as SchemaTable);
}

function addedTables(changes: SchemaChange[]): SchemaTable[] {
  return changes
    .filter((change) => change.target === "table" && change.kind === "add")
    .map((change) => change.after as SchemaTable);
}

export function MigrationWorkspace({
  current,
  snapshot,
  onClose,
  onRestore,
}: MigrationWorkspaceProps) {
  const [renameMappings, setRenameMappings] = useState<RenameMapping[]>([]);
  const [tableRename, setTableRename] = useState<RenameChoice>({
    from: "",
    to: "",
  });
  const [columnRename, setColumnRename] = useState<RenameChoice>({
    from: "",
    to: "",
  });
  const [copied, setCopied] = useState(false);

  const comparison = useMemo(() => {
    const before = parseDbml(snapshot.source);
    const after = parseDbml(current.source);
    if (!before.ok) return { error: before.error.message };
    if (!after.ok) return { error: after.error.message };
    const changes = diffSchemas(before.schema, after.schema, renameMappings);
    return {
      before: before.schema,
      after: after.schema,
      changes,
      plan: generatePostgresMigration(changes),
    };
  }, [current.source, renameMappings, snapshot.source]);

  if ("error" in comparison) {
    return (
      <section className="migration-workspace">
        <div className="migration-error">
          <AlertTriangle />
          <strong>Unable to compare schemas</strong>
          <span>{comparison.error}</span>
          <button onClick={onClose} type="button">
            Close
          </button>
        </div>
      </section>
    );
  }

  const removed = removedTables(comparison.changes);
  const added = addedTables(comparison.changes);
  const removedColumns = comparison.changes.filter(
    (change) => change.target === "column" && change.kind === "remove",
  );
  const addedColumns = comparison.changes.filter(
    (change) => change.target === "column" && change.kind === "add",
  );

  const confirmDestructive = (): boolean =>
    !comparison.plan.hasDestructive ||
    window.confirm(
      "This migration contains destructive operations. Review the SQL carefully before continuing.",
    );

  const copyMigration = async () => {
    if (!confirmDestructive()) return;
    await navigator.clipboard.writeText(comparison.plan.sql);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <section className="migration-workspace">
      <header className="migration-workspace__header">
        <div>
          <GitCompareArrows />
          <span>
            <strong>Schema diff & migration</strong>
            <small>
              {snapshot.name} → current
            </small>
          </span>
        </div>
        <button
          aria-label="Close schema diff"
          className="icon-button"
          onClick={onClose}
          type="button"
        >
          <X />
        </button>
      </header>

      <div className="migration-workspace__body">
        <aside className="migration-summary">
          <div className="migration-stat-grid">
            <span>
              <strong>{comparison.changes.length}</strong>
              changes
            </span>
            <span className={comparison.plan.hasDestructive ? "is-danger" : ""}>
              <strong>
                {
                  comparison.plan.statements.filter(
                    (statement) => statement.destructive,
                  ).length
                }
              </strong>
              risky
            </span>
          </div>

          {(removed.length > 0 && added.length > 0) ||
          (removedColumns.length > 0 && addedColumns.length > 0) ? (
            <section className="rename-mapper">
              <header>
                <strong>Confirm renames</strong>
                <small>Renames are never guessed automatically.</small>
              </header>
              {removed.length > 0 && added.length > 0 ? (
                <div>
                  <select
                    aria-label="Removed table"
                    onChange={(event) =>
                      setTableRename((currentValue) => ({
                        ...currentValue,
                        from: event.target.value,
                      }))
                    }
                    value={tableRename.from}
                  >
                    <option value="">Removed table…</option>
                    {removed.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.id}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Added table"
                    onChange={(event) =>
                      setTableRename((currentValue) => ({
                        ...currentValue,
                        to: event.target.value,
                      }))
                    }
                    value={tableRename.to}
                  >
                    <option value="">Added table…</option>
                    {added.map((table) => (
                      <option key={table.id} value={table.id}>
                        {table.id}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!tableRename.from || !tableRename.to}
                    onClick={() => {
                      setRenameMappings((currentMappings) => [
                        ...currentMappings,
                        {
                          target: "table",
                          from: tableRename.from,
                          to: tableRename.to,
                        },
                      ]);
                      setTableRename({ from: "", to: "" });
                    }}
                    type="button"
                  >
                    Mark table rename
                  </button>
                </div>
              ) : null}
              {removedColumns.length > 0 && addedColumns.length > 0 ? (
                <div>
                  <select
                    aria-label="Removed column"
                    onChange={(event) =>
                      setColumnRename((currentValue) => ({
                        ...currentValue,
                        from: event.target.value,
                      }))
                    }
                    value={columnRename.from}
                  >
                    <option value="">Removed column…</option>
                    {removedColumns.map((change) => (
                      <option key={change.id} value={change.path}>
                        {change.path}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Added column"
                    onChange={(event) =>
                      setColumnRename((currentValue) => ({
                        ...currentValue,
                        to: event.target.value,
                      }))
                    }
                    value={columnRename.to}
                  >
                    <option value="">Added column…</option>
                    {addedColumns.map((change) => (
                      <option key={change.id} value={change.path}>
                        {change.path}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!columnRename.from || !columnRename.to}
                    onClick={() => {
                      setRenameMappings((currentMappings) => [
                        ...currentMappings,
                        {
                          target: "column",
                          from: columnRename.from,
                          to: columnRename.to,
                        },
                      ]);
                      setColumnRename({ from: "", to: "" });
                    }}
                    type="button"
                  >
                    Mark column rename
                  </button>
                </div>
              ) : null}
              {renameMappings.length > 0 ? (
                <ul>
                  {renameMappings.map((mapping) => (
                    <li key={`${mapping.target}-${mapping.from}-${mapping.to}`}>
                      <span>
                        {mapping.from} → {mapping.to}
                      </span>
                      <button
                        onClick={() =>
                          setRenameMappings((currentMappings) =>
                            currentMappings.filter(
                              (candidate) => candidate !== mapping,
                            ),
                          )
                        }
                        type="button"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ) : null}

          <section className="change-list">
            <header>Semantic changes</header>
            {comparison.changes.length === 0 ? (
              <p>No schema changes.</p>
            ) : null}
            {comparison.changes.map((change) => (
              <article
                className={change.destructive ? "is-destructive" : ""}
                key={change.id}
              >
                <span>
                  {change.kind} · {change.target}
                </span>
                <strong>{change.summary}</strong>
              </article>
            ))}
          </section>
        </aside>

        <main className="migration-preview">
          {comparison.plan.warnings.length > 0 ? (
            <div className="migration-warnings">
              <ShieldAlert />
              <div>
                {comparison.plan.warnings.map((warning) => (
                  <span key={warning}>{warning}</span>
                ))}
              </div>
            </div>
          ) : null}
          <header>
            <span>
              <strong>PostgreSQL migration</strong>
              <small>{comparison.plan.statements.length} statements</small>
            </span>
            <div>
              <button
                disabled={!comparison.plan.sql}
                onClick={() => void copyMigration()}
                type="button"
              >
                {copied ? <Check /> : <Clipboard />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                disabled={!comparison.plan.sql}
                onClick={() => {
                  if (confirmDestructive()) {
                    downloadSql(current.name, comparison.plan.sql);
                  }
                }}
                type="button"
              >
                <Download />
                Download
              </button>
              <button onClick={() => onRestore(snapshot)} type="button">
                <RotateCcw />
                Restore snapshot
              </button>
            </div>
          </header>
          <pre>
            {comparison.plan.sql || "-- No migration statements generated."}
          </pre>
        </main>
      </div>
    </section>
  );
}

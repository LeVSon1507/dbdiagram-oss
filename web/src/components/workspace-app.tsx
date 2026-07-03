"use client";

import {
  exporter,
  importer,
  type ExportFormat,
  type ImportFormat,
} from "@dbml/core";
import {
  Check,
  ChevronDown,
  Database,
  Download,
  FileCode2,
  Menu,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { parseDbml } from "@/lib/schema";
import { analyzeSchema } from "@/lib/suggestions";
import {
  createDocument,
  loadWorkspace,
  saveWorkspace,
  type DiagramDocument,
  type Point,
  type Theme,
  type Workspace,
} from "@/lib/workspace";

import { DbmlEditor } from "./dbml-editor";
import { DiagramCanvas } from "./diagram-canvas";
import { AiAssistant } from "./ai-assistant";

const EMPTY_SOURCE = `Table users {
  id bigint [pk, increment]
  email varchar(255) [not null, unique]
  created_at timestamp [not null, default: \`now()\`]
}
`;

const IMPORT_OPTIONS: { format: ImportFormat; label: string }[] = [
  { format: "dbml", label: "DBML" },
  { format: "postgres", label: "PostgreSQL" },
  { format: "mysql", label: "MySQL" },
  { format: "mssql", label: "SQL Server" },
  { format: "oracle", label: "Oracle" },
];

const EXPORT_OPTIONS: { format: ExportFormat; label: string; extension: string }[] =
  [
    { format: "dbml", label: "DBML", extension: "dbml" },
    { format: "postgres", label: "PostgreSQL", extension: "sql" },
    { format: "mysql", label: "MySQL", extension: "sql" },
    { format: "mssql", label: "SQL Server", extension: "sql" },
    { format: "oracle", label: "Oracle", extension: "sql" },
    { format: "json", label: "JSON model", extension: "json" },
  ];

function safeFileName(name: string): string {
  const normalized = name
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "diagram";
}

function downloadText(fileName: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function currentDocument(workspace: Workspace): DiagramDocument {
  return (
    workspace.documents.find(
      (document) => document.id === workspace.currentDocumentId,
    ) ?? workspace.documents[0]
  );
}

export function WorkspaceApp() {
  const [workspace, setWorkspace] = useState<Workspace>();
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [transferError, setTransferError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFormatRef = useRef<ImportFormat>("dbml");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setWorkspace(loadWorkspace(window.localStorage));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!workspace) return;
    saveWorkspace(window.localStorage, workspace);
    globalThis.document.documentElement.dataset.theme = workspace.theme;
  }, [workspace]);

  const activeDocument = workspace ? currentDocument(workspace) : undefined;
  const deferredSource = useDeferredValue(activeDocument?.source ?? "");
  const parseResult = useMemo(
    () => parseDbml(deferredSource),
    [deferredSource],
  );
  const insights = useMemo(
    () => (parseResult.ok ? analyzeSchema(parseResult.schema) : []),
    [parseResult],
  );

  const updateCurrentDocument = useCallback(
    (update: (document: DiagramDocument) => DiagramDocument) => {
      setWorkspace((current) => {
        if (!current) return current;
        return {
          ...current,
          documents: current.documents.map((item) =>
            item.id === current.currentDocumentId ? update(item) : item,
          ),
        };
      });
    },
    [],
  );

  const updateSource = useCallback(
    (source: string) => {
      updateCurrentDocument((current) => ({
        ...current,
        source,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateCurrentDocument],
  );

  const updatePositions = useCallback(
    (positions: Record<string, Point>) => {
      updateCurrentDocument((current) => ({
        ...current,
        positions,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateCurrentDocument],
  );

  const addDocument = useCallback(() => {
    setWorkspace((current) => {
      if (!current) return current;
      const next = createDocument(
        `Diagram ${current.documents.length + 1}`,
        EMPTY_SOURCE,
      );
      return {
        ...current,
        currentDocumentId: next.id,
        documents: [...current.documents, next],
      };
    });
    setSidebarOpen(false);
  }, []);

  const deleteDocument = useCallback((documentId: string) => {
    setWorkspace((current) => {
      if (!current) return current;
      const remaining = current.documents.filter(
        (item) => item.id !== documentId,
      );
      if (remaining.length > 0) {
        return {
          ...current,
          currentDocumentId:
            current.currentDocumentId === documentId
              ? remaining[0].id
              : current.currentDocumentId,
          documents: remaining,
        };
      }

      const replacement = createDocument("Untitled diagram", EMPTY_SOURCE);
      return {
        ...current,
        currentDocumentId: replacement.id,
        documents: [replacement],
      };
    });
  }, []);

  const selectDocument = useCallback((documentId: string) => {
    setWorkspace((current) =>
      current ? { ...current, currentDocumentId: documentId } : current,
    );
    setSidebarOpen(false);
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    setWorkspace((current) => (current ? { ...current, theme } : current));
  }, []);

  const chooseImport = useCallback((format: ImportFormat) => {
    importFormatRef.current = format;
    fileInputRef.current?.click();
  }, []);

  const handleImport = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      try {
        const input = await file.text();
        const source =
          importFormatRef.current === "dbml"
            ? input
            : importer.import(input, importFormatRef.current);
        const imported = parseDbml(source);
        if (!imported.ok) {
          throw new Error(imported.error.message);
        }

        const next = createDocument(file.name.replace(/\.[^.]+$/, ""), source);
        setWorkspace((current) =>
          current
            ? {
                ...current,
                currentDocumentId: next.id,
                documents: [...current.documents, next],
              }
            : current,
        );
        setTransferError(undefined);
      } catch (error: unknown) {
        setTransferError(
          error instanceof Error ? error.message : "Unable to import this file.",
        );
      }
    },
    [],
  );

  const handleExport = useCallback(
    (format: ExportFormat, extension: string) => {
      if (!activeDocument) return;
      try {
        const content =
          format === "dbml"
            ? activeDocument.source
            : exporter.export(activeDocument.source, format);
        downloadText(
          `${safeFileName(activeDocument.name)}.${extension}`,
          content,
        );
        setTransferError(undefined);
      } catch (error: unknown) {
        setTransferError(
          error instanceof Error ? error.message : "Unable to export diagram.",
        );
      }
    },
    [activeDocument],
  );

  const applyAiSource = useCallback(
    (source: string) => {
      const parsed = parseDbml(source);
      if (!parsed.ok) {
        setTransferError(`AI proposal is invalid: ${parsed.error.message}`);
        return;
      }
      updateSource(source);
      setTransferError(undefined);
    },
    [updateSource],
  );

  if (!workspace || !activeDocument) {
    return (
      <main className="loading-screen">
        <Database />
        <span>Loading your workspace…</span>
      </main>
    );
  }

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <div className="brand">
          <button
            aria-label="Open diagrams"
            className="icon-button mobile-only"
            onClick={() => setSidebarOpen(true)}
            type="button"
          >
            <Menu />
          </button>
          <span className="brand__mark">
            <Database />
          </span>
          <span className="brand__name">Schema Studio</span>
          <span className="local-badge">LOCAL</span>
        </div>
        <div className="document-title">
          <input
            aria-label="Diagram name"
            onChange={(event) =>
              updateCurrentDocument((current) => ({
                ...current,
                name: event.target.value,
                updatedAt: new Date().toISOString(),
              }))
            }
            spellCheck={false}
            value={activeDocument.name}
          />
          <span>
            <Check />
            Saved locally
          </span>
        </div>
        <div className="topbar__actions">
          <button
            className={`ai-trigger ${aiOpen ? "is-active" : ""}`}
            onClick={() => setAiOpen((current) => !current)}
            type="button"
          >
            <Sparkles />
            <span>AI Architect</span>
            {insights.some((insight) => insight.severity === "warning") ? (
              <small>
                {
                  insights.filter(
                    (insight) => insight.severity === "warning",
                  ).length
                }
              </small>
            ) : null}
          </button>
          <details className="action-menu">
            <summary>
              <Upload />
              <span>Import</span>
              <ChevronDown />
            </summary>
            <div className="action-menu__content">
              <small>Import as</small>
              {IMPORT_OPTIONS.map((option) => (
                <button
                  key={option.format}
                  onClick={() => chooseImport(option.format)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </details>
          <details className="action-menu">
            <summary className="is-primary">
              <Download />
              <span>Export</span>
              <ChevronDown />
            </summary>
            <div className="action-menu__content action-menu__content--right">
              <small>Export as</small>
              {EXPORT_OPTIONS.map((option) => (
                <button
                  key={option.format}
                  onClick={() =>
                    handleExport(option.format, option.extension)
                  }
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </details>
          <button
            aria-label={`Switch to ${
              workspace.theme === "dark" ? "light" : "dark"
            } theme`}
            className="icon-button"
            onClick={() =>
              setTheme(workspace.theme === "dark" ? "light" : "dark")
            }
            type="button"
          >
            {workspace.theme === "dark" ? <Sun /> : <Moon />}
          </button>
        </div>
      </header>

      <div className="workspace-body">
        <aside className={`sidebar ${sidebarOpen ? "is-open" : ""}`}>
          <div className="sidebar__mobile-heading">
            <strong>Your diagrams</strong>
            <button
              aria-label="Close diagrams"
              className="icon-button"
              onClick={() => setSidebarOpen(false)}
              type="button"
            >
              <X />
            </button>
          </div>
          <button className="new-diagram" onClick={addDocument} type="button">
            <Plus />
            New diagram
          </button>
          <nav aria-label="Diagrams" className="diagram-list">
            {workspace.documents.map((item) => (
              <div
                className={`diagram-list__item ${
                  item.id === workspace.currentDocumentId ? "is-active" : ""
                }`}
                key={item.id}
              >
                <button
                  className="diagram-list__select"
                  onClick={() => selectDocument(item.id)}
                  type="button"
                >
                  <FileCode2 />
                  <span>
                    <strong>{item.name || "Untitled diagram"}</strong>
                    <small>
                      {new Date(item.updatedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </small>
                  </span>
                </button>
                <button
                  aria-label={`Delete ${item.name}`}
                  className="diagram-list__delete"
                  onClick={() => deleteDocument(item.id)}
                  type="button"
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </nav>
          <footer className="sidebar__footer">
            <span>Local-first by default</span>
            <small>Only explicit AI actions send the current DBML.</small>
          </footer>
        </aside>
        {sidebarOpen ? (
          <button
            aria-label="Close sidebar"
            className="sidebar-backdrop"
            onClick={() => setSidebarOpen(false)}
            type="button"
          />
        ) : null}

        <div className="workbench">
          <DbmlEditor
            error={parseResult.ok ? undefined : parseResult.error}
            onChange={updateSource}
            source={activeDocument.source}
            theme={workspace.theme}
          />
          <section className="canvas-panel">
            <header className="panel-heading canvas-heading">
              <div>
                <Database />
                <span>Diagram</span>
                {parseResult.ok ? (
                  <small>
                    {parseResult.schema.tables.length} tables ·{" "}
                    {parseResult.schema.relations.length} relations
                  </small>
                ) : null}
              </div>
              <label className="table-search">
                <Search />
                <input
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a table…"
                  type="search"
                  value={search}
                />
              </label>
            </header>
            <div className="canvas-stage">
              {parseResult.ok ? (
                <DiagramCanvas
                  key={activeDocument.id}
                  onPositionsChange={updatePositions}
                  positions={activeDocument.positions}
                  schema={parseResult.schema}
                  search={search}
                  theme={workspace.theme}
                />
              ) : (
                <div className="invalid-schema">
                  <FileCode2 />
                  <strong>Fix the DBML to update the diagram</strong>
                  <span>The last valid source remains saved locally.</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      <input
        accept=".dbml,.sql,.json,.rb"
        className="visually-hidden"
        onChange={(event) => void handleImport(event)}
        ref={fileInputRef}
        type="file"
      />
      {transferError ? (
        <div className="toast" role="alert">
          <span>{transferError}</span>
          <button
            aria-label="Dismiss error"
            onClick={() => setTransferError(undefined)}
            type="button"
          >
            <X />
          </button>
        </div>
      ) : null}
      <AiAssistant
        insights={insights}
        onApply={applyAiSource}
        onClose={() => setAiOpen(false)}
        open={aiOpen}
        source={activeDocument.source}
      />
    </main>
  );
}

"use client";

import { autocompletion, startCompletion } from "@codemirror/autocomplete";
import {
  HighlightStyle,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import type { Text } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import CodeMirror from "@uiw/react-codemirror";
import {
  AlertCircle,
  Braces,
  ChevronDown,
  ChevronUp,
  WandSparkles,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { dbmlCompletionSource, dbmlLanguage } from "@/lib/dbml-language";
import type { SchemaDiagnostic } from "@/lib/schema";
import type { Theme } from "@/lib/workspace";

interface DbmlEditorProps {
  source: string;
  diagnostics: SchemaDiagnostic[];
  theme: Theme;
  onChange: (source: string) => void;
}

const COMPLETION_SHORTCUT_HINT = "Suggestions enabled · ⌘/Ctrl Shift Space";

const VSCODE_LIGHT_EDITOR_THEME = [
  EditorView.theme({
    "&": {
      color: "#000000",
    },
    ".cm-content": {
      caretColor: "#000000",
    },
    ".cm-cursor, .cm-dropCursor": {
      borderLeftColor: "#000000",
    },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
      backgroundColor: "#cfe2f3",
    },
  }),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: "#4b57c5" },
      { tag: tags.typeName, color: "#2f7f91" },
      { tag: tags.propertyName, color: "#285a8e" },
      { tag: tags.variableName, color: "#285a8e" },
      { tag: tags.string, color: "#a34f3f" },
      { tag: tags.number, color: "#397a5f" },
      { tag: tags.color, color: "#87652e" },
      { tag: tags.comment, color: "#5f7a55" },
    ]),
  ),
];

const VSCODE_DARK_EDITOR_THEME = [
  EditorView.theme(
    {
      "&": {
        color: "#d4d4d4",
        backgroundColor: "#1e1e1e",
      },
      ".cm-content": {
        caretColor: "#aeafad",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "#aeafad",
      },
      "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
        backgroundColor: "#264f78",
      },
      ".cm-gutters": {
        color: "#858585",
        backgroundColor: "#1e1e1e",
        borderRightColor: "#3c3c3c",
      },
      ".cm-activeLine, .cm-activeLineGutter": {
        backgroundColor: "#252526",
      },
      ".cm-matchingBracket": {
        color: "#ffd700",
        outline: "1px solid #8f8f8f",
      },
    },
    { dark: true },
  ),
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: "#c586c0" },
      { tag: tags.typeName, color: "#4ec9b0" },
      { tag: tags.propertyName, color: "#9cdcfe" },
      { tag: tags.variableName, color: "#9cdcfe" },
      { tag: tags.string, color: "#ce9178" },
      { tag: tags.number, color: "#b5cea8" },
      { tag: tags.color, color: "#d7ba7d" },
      { tag: tags.comment, color: "#6a9955" },
    ]),
  ),
];

function runManualCompletion(editorView: EditorView): boolean {
  return startCompletion(editorView);
}

function documentOffset(
  document: Text,
  lineNumber: number,
  columnNumber: number,
): number {
  const line = document.line(Math.min(Math.max(lineNumber, 1), document.lines));
  return Math.min(line.to, line.from + Math.max(columnNumber - 1, 0));
}

function codeMirrorDiagnostic(
  document: Text,
  diagnostic: SchemaDiagnostic,
): Diagnostic {
  const from = documentOffset(document, diagnostic.line, diagnostic.column);
  const end = documentOffset(
    document,
    diagnostic.endLine,
    diagnostic.endColumn,
  );
  const to = Math.max(from, Math.min(document.length, end));

  return {
    from,
    to: to === from && from < document.length ? from + 1 : to,
    severity: diagnostic.severity,
    source: diagnostic.code ? `DBML ${diagnostic.code}` : "DBML",
    message: diagnostic.message,
  };
}

export function DbmlEditor({
  source,
  diagnostics = [],
  theme,
  onChange,
}: DbmlEditorProps) {
  const editorView = useRef<EditorView | null>(null);
  const [problemsOpen, setProblemsOpen] = useState(true);
  const extensions = useMemo(
    () => [
      dbmlLanguage,
      lintGutter(),
      keymap.of([
        {
          key: "Mod-Shift-Space",
          run: runManualCompletion,
        },
      ]),
      autocompletion({
        activateOnTyping: true,
        maxRenderedOptions: 80,
        override: [dbmlCompletionSource],
      }),
    ],
    [],
  );

  useEffect(() => {
    const view = editorView.current;
    if (!view) return;

    view.dispatch(
      setDiagnostics(
        view.state,
        diagnostics.map((diagnostic) =>
          codeMirrorDiagnostic(view.state.doc, diagnostic),
        ),
      ),
    );
  }, [diagnostics]);

  const focusDiagnostic = (diagnostic: SchemaDiagnostic) => {
    const view = editorView.current;
    if (!view) return;

    const from = documentOffset(
      view.state.doc,
      diagnostic.line,
      diagnostic.column,
    );
    const to = documentOffset(
      view.state.doc,
      diagnostic.endLine,
      diagnostic.endColumn,
    );
    view.dispatch({
      selection: { anchor: from, head: Math.max(from, to) },
      effects: EditorView.scrollIntoView(from, { y: "center" }),
    });
    view.focus();
  };

  return (
    <section className="editor-panel">
      <header className="panel-heading">
        <div>
          <Braces />
          <span>DBML</span>
        </div>
        <a
          href="https://dbml.dbdiagram.io/docs/"
          rel="noreferrer"
          target="_blank"
        >
          Syntax guide
        </a>
      </header>
      <CodeMirror
        aria-label="DBML editor"
        basicSetup={{
          bracketMatching: true,
          closeBrackets: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          lineNumbers: true,
        }}
        className="dbml-editor"
        extensions={extensions}
        height="100%"
        onChange={onChange}
        onCreateEditor={(view) => {
          editorView.current = view;
          view.dispatch(
            setDiagnostics(
              view.state,
              diagnostics.map((diagnostic) =>
                codeMirrorDiagnostic(view.state.doc, diagnostic),
              ),
            ),
          );
        }}
        theme={
          theme === "dark"
            ? VSCODE_DARK_EDITOR_THEME
            : VSCODE_LIGHT_EDITOR_THEME
        }
        value={source}
      />
      {diagnostics.length > 0 ? (
        <section
          aria-label="DBML problems"
          aria-live="polite"
          className="editor-problems"
        >
          <button
            aria-expanded={problemsOpen}
            className="editor-problems__heading"
            onClick={() => setProblemsOpen((open) => !open)}
            type="button"
          >
            <span>
              <AlertCircle />
              <strong>
                {diagnostics.length}{" "}
                {diagnostics.length === 1 ? "problem" : "problems"}
              </strong>
            </span>
            <span className="editor-problems__summary">
              {diagnostics[0].message}
            </span>
            {problemsOpen ? <ChevronDown /> : <ChevronUp />}
          </button>
          {problemsOpen ? (
            <div className="editor-problems__list" role="list">
              {diagnostics.map((diagnostic, index) => (
                <button
                  className={`editor-problem is-${diagnostic.severity}`}
                  key={`${diagnostic.line}-${diagnostic.column}-${diagnostic.message}-${index}`}
                  onClick={() => focusDiagnostic(diagnostic)}
                  role="listitem"
                  type="button"
                >
                  <AlertCircle />
                  <span className="editor-problem__location">
                    Ln {diagnostic.line}, Col {diagnostic.column}
                  </span>
                  <span className="editor-problem__message">
                    {diagnostic.message}
                  </span>
                  {diagnostic.code ? <code>DBML {diagnostic.code}</code> : null}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : (
        <footer className="editor-status">
          <>
            <span className="status-dot" />
            <span>Schema valid</span>
            <span className="editor-status__hint">
              <WandSparkles />
              {COMPLETION_SHORTCUT_HINT}
            </span>
          </>
        </footer>
      )}
    </section>
  );
}

"use client";

import { autocompletion } from "@codemirror/autocomplete";
import CodeMirror from "@uiw/react-codemirror";
import { AlertCircle, Braces, WandSparkles } from "lucide-react";
import { useMemo } from "react";

import { dbmlCompletionSource, dbmlLanguage } from "@/lib/dbml-language";
import type { SchemaError } from "@/lib/schema";
import type { Theme } from "@/lib/workspace";

interface DbmlEditorProps {
  source: string;
  error?: SchemaError;
  theme: Theme;
  onChange: (source: string) => void;
}

export function DbmlEditor({
  source,
  error,
  theme,
  onChange,
}: DbmlEditorProps) {
  const extensions = useMemo(
    () => [
      dbmlLanguage,
      autocompletion({
        activateOnTyping: true,
        override: [dbmlCompletionSource],
      }),
    ],
    [],
  );

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
        theme={theme}
        value={source}
      />
      <footer className={`editor-status ${error ? "has-error" : ""}`}>
        {error ? (
          <>
            <AlertCircle />
            <span>
              {error.line ? `Line ${error.line}:${error.column ?? 1} — ` : ""}
              {error.message}
            </span>
          </>
        ) : (
          <>
            <span className="status-dot" />
            <span>Schema valid</span>
            <span className="editor-status__hint">
              <WandSparkles />
              Suggestions enabled · Ctrl/⌘ Space
            </span>
          </>
        )}
      </footer>
    </section>
  );
}

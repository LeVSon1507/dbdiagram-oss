"use client";

import CodeMirror from "@uiw/react-codemirror";
import { AlertCircle, Braces } from "lucide-react";

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
            Schema valid
          </>
        )}
      </footer>
    </section>
  );
}

"use client";

import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Lightbulb,
  LoaderCircle,
  ScanSearch,
  Send,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { AiAction, AiResult } from "@/lib/ai";
import type { SchemaInsight } from "@/lib/suggestions";

interface AiAssistantProps {
  insights: SchemaInsight[];
  open: boolean;
  source: string;
  onApply: (source: string) => void;
  onClose: () => void;
}

interface AiStatus {
  configured: boolean;
  model?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStatus(value: unknown): AiStatus {
  if (!isRecord(value) || typeof value.configured !== "boolean") {
    return { configured: false };
  }
  return {
    configured: value.configured,
    model: typeof value.model === "string" ? value.model : undefined,
  };
}

function parseResult(value: unknown): AiResult | undefined {
  if (!isRecord(value) || typeof value.message !== "string") return undefined;
  return {
    message: value.message,
    dbml: typeof value.dbml === "string" ? value.dbml : undefined,
    suggestions: Array.isArray(value.suggestions)
      ? value.suggestions.filter(
          (suggestion): suggestion is string => typeof suggestion === "string",
        )
      : [],
  };
}

function errorFrom(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : fallback;
}

export function AiAssistant({
  insights,
  open,
  source,
  onApply,
  onClose,
}: AiAssistantProps) {
  const [status, setStatus] = useState<AiStatus>({ configured: false });
  const [action, setAction] = useState<AiAction>("ask");
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<AiResult>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch("/api/ai", { signal: controller.signal })
      .then(async (response) => {
        const value: unknown = await response.json();
        setStatus(parseStatus(value));
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStatus({ configured: false });
        }
      });
    return () => controller.abort();
  }, [open]);

  const run = useCallback(
    async (nextAction: AiAction = action, nextPrompt = prompt) => {
      setAction(nextAction);
      setPrompt(nextPrompt);
      setLoading(true);
      setError(undefined);
      setResult(undefined);

      try {
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: nextAction,
            prompt: nextPrompt,
            source,
          }),
        });
        const value: unknown = await response.json();
        if (!response.ok) {
          throw new Error(errorFrom(value, "AI request failed."));
        }
        const parsed = parseResult(value);
        if (!parsed) throw new Error("AI returned an unsupported response.");
        setResult(parsed);
      } catch (requestError: unknown) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "AI request failed.",
        );
      } finally {
        setLoading(false);
      }
    },
    [action, prompt, source],
  );

  return (
    <aside
      aria-label="AI Assistant"
      className={`ai-panel ${open ? "is-open" : ""}`}
    >
      <header className="ai-panel__header">
        <div className="ai-panel__title">
          <span>
            <Sparkles />
          </span>
          <div>
            <strong>AI Architect</strong>
            <small>
              {status.configured
                ? status.model ?? "Connected"
                : "Configuration required"}
            </small>
          </div>
        </div>
        <button
          aria-label="Close AI Assistant"
          className="icon-button"
          onClick={onClose}
          type="button"
        >
          <X />
        </button>
      </header>

      <div className="ai-panel__body">
        <section className="ai-privacy">
          <ShieldCheck />
          <span>
            Your DBML is sent only when you run an AI action. API credentials
            stay on the server.
          </span>
        </section>

        <section className="ai-section">
          <div className="ai-section__heading">
            <span>Quick actions</span>
          </div>
          <div className="ai-quick-actions">
            <button
              disabled={loading}
              onClick={() => void run("review", "")}
              type="button"
            >
              <ScanSearch />
              <span>
                <strong>Review schema</strong>
                <small>Find integrity and scaling risks</small>
              </span>
            </button>
            <button
              disabled={loading}
              onClick={() => void run("improve", prompt)}
              type="button"
            >
              <WandSparkles />
              <span>
                <strong>Improve DBML</strong>
                <small>Propose a safer complete schema</small>
              </span>
            </button>
          </div>
        </section>

        <section className="ai-section">
          <div className="ai-section__heading">
            <span>Local insights</span>
            <small>{insights.length}</small>
          </div>
          <div className="insight-list">
            {insights.map((insight) => (
              <button
                className={`insight-card is-${insight.severity}`}
                key={insight.id}
                onClick={() => {
                  setAction("ask");
                  setPrompt(insight.aiPrompt);
                }}
                type="button"
              >
                {insight.severity === "warning" ? (
                  <CircleAlert />
                ) : insight.severity === "success" ? (
                  <CheckCircle2 />
                ) : (
                  <Lightbulb />
                )}
                <span>
                  <strong>{insight.title}</strong>
                  <small>{insight.description}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="ai-section ai-compose">
          <div className="ai-section__heading">
            <span>Ask about this schema</span>
          </div>
          <textarea
            maxLength={4000}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="e.g. Add multi-tenant support and explain the tradeoffs…"
            value={prompt}
          />
          <div className="ai-compose__footer">
            <span>{prompt.length}/4000</span>
            <button
              disabled={loading || !prompt.trim()}
              onClick={() => void run("ask", prompt)}
              type="button"
            >
              {loading ? <LoaderCircle className="is-spinning" /> : <Send />}
              {loading ? "Thinking…" : "Ask AI"}
            </button>
          </div>
        </section>

        {!status.configured ? (
          <section className="ai-setup">
            <Bot />
            <div>
              <strong>Connect an AI model</strong>
              <span>
                Set <code>AI_BASE_URL</code> and <code>AI_MODEL</code> in{" "}
                <code>.env.local</code>. Add <code>AI_API_KEY</code> when the
                provider requires authentication.
              </span>
            </div>
          </section>
        ) : null}

        {error ? (
          <section className="ai-response is-error">
            <CircleAlert />
            <span>{error}</span>
          </section>
        ) : null}

        {result ? (
          <section className="ai-result">
            <header>
              <Sparkles />
              <strong>AI response</strong>
            </header>
            <p>{result.message}</p>
            {result.suggestions.length > 0 ? (
              <ul>
                {result.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            ) : null}
            {result.dbml ? (
              <div className="ai-proposal">
                <div>
                  <strong>Proposed DBML</strong>
                  <small>{result.dbml.split("\n").length} lines</small>
                </div>
                <pre>{result.dbml.slice(0, 1400)}</pre>
                <button onClick={() => onApply(result.dbml ?? "")} type="button">
                  <CheckCircle2 />
                  Apply to editor
                </button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </aside>
  );
}

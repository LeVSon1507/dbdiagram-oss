import { NextResponse } from "next/server";

import {
  buildAiMessages,
  parseAiRequest,
  parseAiResult,
  readChatCompletionContent,
} from "@/lib/ai";

interface AiConfiguration {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

function environmentValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function configuration(): AiConfiguration {
  return {
    baseUrl: environmentValue(process.env.AI_BASE_URL),
    apiKey: environmentValue(process.env.AI_API_KEY),
    model: environmentValue(process.env.AI_MODEL),
  };
}

export function GET() {
  const config = configuration();
  return NextResponse.json({
    configured: Boolean(config.baseUrl && config.model),
    model: config.model ?? null,
  });
}

export async function POST(request: Request) {
  const config = configuration();
  if (!config.baseUrl || !config.model) {
    return NextResponse.json(
      {
        error:
          "AI is not configured. Set AI_BASE_URL and AI_MODEL on the server.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = parseAiRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey
            ? { Authorization: `Bearer ${config.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          model: config.model,
          messages: buildAiMessages(parsed.request),
          temperature: 0.2,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(60_000),
      },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `AI provider returned HTTP ${response.status}.` },
        { status: 502 },
      );
    }

    const payload: unknown = await response.json();
    const content = readChatCompletionContent(payload);
    if (!content) {
      return NextResponse.json(
        { error: "AI provider returned an unsupported response." },
        { status: 502 },
      );
    }

    return NextResponse.json(parseAiResult(content));
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.name === "TimeoutError"
        ? "AI request timed out."
        : "Unable to reach the AI provider.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

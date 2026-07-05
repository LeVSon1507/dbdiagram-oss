import { NextResponse } from "next/server";

import {
  buildAiMessages,
  parseAiRequest,
  parseAiResult,
  readChatCompletionContent,
} from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface AiConfiguration {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

const MAX_REQUEST_BYTES = 256_000;
const MAX_PROVIDER_RESPONSE_LENGTH = 240_000;
const PRIVATE_RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
} as const;

function json(
  body: object,
  status = 200,
): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: PRIVATE_RESPONSE_HEADERS,
  });
}

function environmentValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function configuration(): AiConfiguration {
  return {
    baseUrl: environmentValue(process.env.AI_BASE_URL),
    apiKey: environmentValue(process.env.AI_API_KEY),
    model: environmentValue(process.env.AI_MODEL),
  };
}

function providerEndpoint(baseUrl: string): string | undefined {
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return undefined;
    }
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/chat/completions`;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

export function GET() {
  const config = configuration();
  return json({
    configured: Boolean(
      config.baseUrl && providerEndpoint(config.baseUrl) && config.model,
    ),
    model: config.model ?? null,
  });
}

export async function POST(request: Request) {
  const config = configuration();
  if (!config.baseUrl || !config.model) {
    return json(
      {
        error:
          "AI is not configured. Set AI_BASE_URL and AI_MODEL on the server.",
      },
      503,
    );
  }

  const endpoint = providerEndpoint(config.baseUrl);
  if (!endpoint) {
    return json(
      { error: "AI_BASE_URL must be a valid HTTP or HTTPS URL." },
      503,
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return json({ error: "AI request body is too large." }, 413);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const parsed = parseAiRequest(body);
  if (!parsed.ok) {
    return json({ error: parsed.error }, 400);
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
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
      signal: AbortSignal.timeout(55_000),
    });

    if (!response.ok) {
      return json(
        {
          error: `AI provider returned HTTP ${response.status}.`,
        },
        502,
      );
    }

    const payload: unknown = await response.json();
    const content = readChatCompletionContent(payload);
    if (!content) {
      return json(
        { error: "AI provider returned an unsupported response." },
        502,
      );
    }
    if (content.length > MAX_PROVIDER_RESPONSE_LENGTH) {
      return json({ error: "AI provider response is too large." }, 502);
    }

    return json(parseAiResult(content));
  } catch (error: unknown) {
    const message =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError")
        ? "AI request timed out."
        : "Unable to reach the AI provider.";
    return json({ error: message }, 502);
  }
}

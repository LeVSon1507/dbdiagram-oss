import { afterEach, describe, expect, it, vi } from "vitest";

import { GET, POST } from "./route";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("AI server route", () => {
  it("reports configuration without exposing the API key", async () => {
    process.env.AI_BASE_URL = "https://provider.example/v1";
    process.env.AI_MODEL = "test-model";
    process.env.AI_API_KEY = "server-secret";

    const response = GET();
    const responseText = await response.clone().text();
    const body: unknown = await response.json();

    expect(body).toEqual({ configured: true, model: "test-model" });
    expect(responseText).not.toContain("server-secret");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("adds the provider key only to the server-side provider request", async () => {
    process.env.AI_BASE_URL = "https://provider.example/v1/";
    process.env.AI_MODEL = "test-model";
    process.env.AI_API_KEY = "server-secret";
    const providerFetch = vi.fn(async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                message: "Schema reviewed.",
                suggestions: [],
              }),
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", providerFetch);

    const response = await POST(
      new Request("https://app.example/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          source: "Table users { id bigint [pk] }",
          prompt: "",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain("server-secret");
    expect(providerFetch).toHaveBeenCalledOnce();
    expect(providerFetch).toHaveBeenCalledWith(
      "https://provider.example/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer server-secret",
        }),
      }),
    );
  });

  it("rejects an invalid provider URL before making a request", async () => {
    process.env.AI_BASE_URL = "file:///tmp/provider";
    process.env.AI_MODEL = "test-model";
    const providerFetch = vi.fn();
    vi.stubGlobal("fetch", providerFetch);

    const response = await POST(
      new Request("https://app.example/api/ai", {
        method: "POST",
        body: "{}",
      }),
    );

    expect(response.status).toBe(503);
    expect(providerFetch).not.toHaveBeenCalled();
  });
});

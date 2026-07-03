import { describe, expect, it } from "vitest";

import {
  buildAiMessages,
  parseAiRequest,
  parseAiResult,
  readChatCompletionContent,
} from "./ai";

describe("AI contracts", () => {
  it("validates supported requests", () => {
    expect(
      parseAiRequest({ action: "ask", source: "Table users {}", prompt: "" }),
    ).toEqual({ ok: false, error: "Describe what you want the AI to do." });
    expect(
      parseAiRequest({
        action: "review",
        source: "Table users {}",
        prompt: "",
      }),
    ).toMatchObject({ ok: true });
  });

  it("keeps the schema in a data boundary in the model prompt", () => {
    const messages = buildAiMessages({
      action: "review",
      source: "Table users {}",
      prompt: "",
    });

    expect(messages[1].content).toContain("<dbml>\nTable users {}\n</dbml>");
  });

  it("parses structured and fenced AI responses", () => {
    expect(
      parseAiResult(
        JSON.stringify({
          message: "Added an index.",
          dbml: "Table users {}",
          suggestions: ["Review retention"],
        }),
      ),
    ).toEqual({
      message: "Added an index.",
      dbml: "Table users {}",
      suggestions: ["Review retention"],
    });
    expect(
      parseAiResult("Proposed schema\n```dbml\nTable users {}\n```").dbml,
    ).toBe("Table users {}");
  });

  it("reads an OpenAI-compatible chat completion", () => {
    expect(
      readChatCompletionContent({
        choices: [{ message: { content: "{\"message\":\"Done\"}" } }],
      }),
    ).toBe("{\"message\":\"Done\"}");
  });
});

import { describe, expect, it } from "vitest";
import { openAiCompatibleTransform } from "../transform";

describe("openAiCompatibleTransform", () => {
  it("merges system prompts and maps non-system messages", () => {
    const transformed = openAiCompatibleTransform.request({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "hello" },
        { role: "tool", content: "{\"ok\":true}", tool_call_id: "tool_1" }
      ]
    });

    expect(transformed.system).toBe("You are helpful.");
    expect(transformed.messages).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "[tool-result] tool_call_id=tool_1 {\"ok\":true}" }
    ]);
  });

  it("maps stream parts to normalized events", () => {
    const textEvents = openAiCompatibleTransform.response({
      type: "text-delta",
      id: "text_1",
      text: "hi"
    });

    expect(textEvents).toEqual([{ type: "content_delta", delta: "hi" }]);

    const finishEvents = openAiCompatibleTransform.response({
      type: "finish",
      finishReason: "stop",
      rawFinishReason: "stop",
      totalUsage: {
        inputTokens: 10,
        inputTokenDetails: {
          noCacheTokens: 10,
          cacheReadTokens: 0,
          cacheWriteTokens: 0
        },
        outputTokens: 5,
        outputTokenDetails: {
          textTokens: 5,
          reasoningTokens: 0
        },
        totalTokens: 15
      }
    });

    expect(finishEvents).toEqual([
      {
        type: "finish",
        reason: "stop",
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15
        }
      }
    ]);
  });
});

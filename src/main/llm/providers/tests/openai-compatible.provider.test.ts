import pino from "pino";
import PQueue from "p-queue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AsyncIterableStream, TextStreamPart, ToolSet } from "ai";
import { OpenAiCompatibleProvider } from "../openai-compatible.provider";

const { streamTextMock, chatMock, createOpenAIMock } = vi.hoisted(() => {
  const localStreamTextMock = vi.fn();
  const localChatMock = vi.fn();
  const localCreateOpenAIMock = vi.fn(() => ({
    chat: localChatMock
  }));

  return {
    streamTextMock: localStreamTextMock,
    chatMock: localChatMock,
    createOpenAIMock: localCreateOpenAIMock
  };
});

vi.mock("ai", () => ({
  streamText: streamTextMock
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: createOpenAIMock
}));

const toAsyncIterableStream = (
  parts: Array<TextStreamPart<ToolSet>>
): AsyncIterableStream<TextStreamPart<ToolSet>> => {
  const iterable: AsyncIterable<TextStreamPart<ToolSet>> = {
    async *[Symbol.asyncIterator]() {
      for (const part of parts) {
        yield part;
      }
    }
  };

  return iterable as AsyncIterableStream<TextStreamPart<ToolSet>>;
};

describe("OpenAiCompatibleProvider", () => {
  beforeEach(() => {
    streamTextMock.mockReset();
    chatMock.mockReset();
    createOpenAIMock.mockClear();
    chatMock.mockReturnValue({ kind: "mock-model" });
  });

  it("maps Vercel AI stream output to normalized events", async () => {
    streamTextMock.mockReturnValue({
      fullStream: toAsyncIterableStream([
        {
          type: "text-delta",
          id: "text_1",
          text: "hello"
        },
        {
          type: "finish",
          finishReason: "stop",
          rawFinishReason: "stop",
          totalUsage: {
            inputTokens: 3,
            inputTokenDetails: {
              noCacheTokens: 3,
              cacheReadTokens: 0,
              cacheWriteTokens: 0
            },
            outputTokens: 2,
            outputTokenDetails: {
              textTokens: 2,
              reasoningTokens: 0
            },
            totalTokens: 5
          }
        }
      ])
    });

    const provider = new OpenAiCompatibleProvider("openai");
    const queue = new PQueue({ concurrency: 1 });
    const context = {
      providerId: "openai",
      runtimeConfig: {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "test-key"
      },
      timeoutMs: 10_000,
      maxRetries: 1,
      retryBaseMs: 10,
      queue,
      logger: pino({ enabled: false })
    };

    const events: unknown[] = [];
    for await (const event of provider.execute(
      {
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: "hello" }]
      },
      context
    )) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: "content_delta",
        delta: "hello"
      },
      {
        type: "finish",
        reason: "stop",
        usage: {
          promptTokens: 3,
          completionTokens: 2,
          totalTokens: 5
        }
      }
    ]);
  });

  it("retries request start when the first attempt fails with retryable status", async () => {
    const retryableError = Object.assign(new Error("temporary failure"), {
      statusCode: 503
    });

    streamTextMock
      .mockImplementationOnce(() => {
        throw retryableError;
      })
      .mockReturnValueOnce({
        fullStream: toAsyncIterableStream([
          {
            type: "text-delta",
            id: "text_1",
            text: "ok"
          },
          {
            type: "finish",
            finishReason: "stop",
            rawFinishReason: "stop",
            totalUsage: {
              inputTokens: 1,
              inputTokenDetails: {
                noCacheTokens: 1,
                cacheReadTokens: 0,
                cacheWriteTokens: 0
              },
              outputTokens: 1,
              outputTokenDetails: {
                textTokens: 1,
                reasoningTokens: 0
              },
              totalTokens: 2
            }
          }
        ])
      });

    const provider = new OpenAiCompatibleProvider("openai");
    const queue = new PQueue({ concurrency: 1 });

    const events: unknown[] = [];
    for await (const event of provider.execute(
      {
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: "hello" }]
      },
      {
        providerId: "openai",
        runtimeConfig: {
          provider: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKey: "test-key"
        },
        timeoutMs: 10_000,
        maxRetries: 1,
        retryBaseMs: 1,
        queue,
        logger: pino({ enabled: false })
      }
    )) {
      events.push(event);
    }

    expect(streamTextMock).toHaveBeenCalledTimes(2);
    expect(events).toEqual([
      {
        type: "content_delta",
        delta: "ok"
      },
      {
        type: "finish",
        reason: "stop",
        usage: {
          promptTokens: 1,
          completionTokens: 1,
          totalTokens: 2
        }
      }
    ]);
  });
});

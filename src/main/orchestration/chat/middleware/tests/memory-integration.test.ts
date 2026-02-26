import { describe, expect, it, vi } from "vitest";
import type { ContextChunk, Conversation, MemoryProvider } from "../../../../memory/contracts/types";
import { MemoryMiddleware } from "../memory";
import type { MiddlewareContext } from "../types";

const createMockProvider = (chunks: ContextChunk[] = []): MemoryProvider & {
  injectContext: ReturnType<typeof vi.fn>;
  storeConversation: ReturnType<typeof vi.fn>;
} => ({
  injectContext: vi.fn(async () => chunks),
  storeConversation: vi.fn(async () => undefined)
});

const createCtx = (overrides: Partial<MiddlewareContext> = {}): MiddlewareContext => ({
  sessionId: "test-session",
  taskId: "test-task",
  workspacePath: "/tmp/test",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "What did we discuss yesterday?" }
  ],
  tools: [],
  metadata: {},
  state: "before_llm",
  ...overrides
});

describe("MemoryMiddleware integration", () => {
  it("injects memory context as system message before LLM", async () => {
    const provider = createMockProvider([
      {
        source: "viking://user/memories/pref.md",
        content: "User prefers TypeScript",
        layer: "L1",
        relevance: 0.9
      }
    ]);

    const middleware = new MemoryMiddleware(provider);
    const ctx = createCtx();
    const result = await middleware.beforeLLM!(ctx);

    expect(provider.injectContext).toHaveBeenCalledWith("test-session", "What did we discuss yesterday?");
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].role).toBe("system");
    expect(result.messages[0].content).toContain("Memory Context");
    expect(result.messages[0].content).toContain("User prefers TypeScript");
    expect(result.metadata.memoryChunksInjected).toBe(1);
  });

  it("passes through context unchanged when no chunks returned", async () => {
    const provider = createMockProvider([]);
    const middleware = new MemoryMiddleware(provider);
    const ctx = createCtx();
    const result = await middleware.beforeLLM!(ctx);

    expect(result.messages).toHaveLength(2);
    expect(result.metadata.memoryChunksInjected).toBeUndefined();
  });

  it("stores conversation on response", async () => {
    const provider = createMockProvider();
    const middleware = new MemoryMiddleware(provider);
    const ctx = createCtx({ state: "response" });
    await middleware.onResponse!(ctx);

    expect(provider.storeConversation).toHaveBeenCalledOnce();
    const stored = provider.storeConversation.mock.calls[0][0] as Conversation;
    expect(stored.sessionId).toBe("test-session");
    expect(stored.messages).toHaveLength(2);
  });

  it("gracefully handles injectContext errors", async () => {
    const provider = createMockProvider();
    provider.injectContext.mockRejectedValueOnce(new Error("network down"));
    const middleware = new MemoryMiddleware(provider);
    const ctx = createCtx();
    const result = await middleware.beforeLLM!(ctx);

    expect(result.messages).toHaveLength(2);
  });

  it("gracefully handles storeConversation errors", async () => {
    const provider = createMockProvider();
    provider.storeConversation.mockRejectedValueOnce(new Error("write failed"));
    const middleware = new MemoryMiddleware(provider);
    const ctx = createCtx();
    const result = await middleware.onResponse!(ctx);

    expect(result.sessionId).toBe("test-session");
  });
});

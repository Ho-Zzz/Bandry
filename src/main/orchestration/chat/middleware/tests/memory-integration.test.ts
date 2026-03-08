import { describe, expect, it, vi } from "vitest";
import type { ContextChunk, Conversation, MemoryProvider } from "../../../../memory/contracts/types";
import { MemoryMiddleware } from "../memory";
import type { MiddlewareContext } from "../types";
import type { AppConfig } from "../../../../config";
import type { ModelsFactory } from "../../../../llm/runtime";
import type { SandboxService } from "../../../../sandbox";

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
  runtime: {
    config: {} as AppConfig,
    modelsFactory: {} as ModelsFactory,
    sandboxService: {} as SandboxService,
    onUpdate: vi.fn()
  },
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
    expect(ctx.runtime?.onUpdate).toHaveBeenCalledWith("planning", "回忆相关上下文");
    expect(ctx.runtime?.onUpdate).toHaveBeenCalledWith("planning", "已回忆 1 条相关记忆");
  });

  it("passes through context unchanged when no chunks returned", async () => {
    const provider = createMockProvider([]);
    const middleware = new MemoryMiddleware(provider);
    const ctx = createCtx();
    const result = await middleware.beforeLLM!(ctx);

    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].role).toBe("system");
    expect(result.messages[0].content).toContain("No relevant memory was retrieved");
    expect(result.metadata.memoryChunksInjected).toBeUndefined();
    expect(result.metadata.memoryStepStarted).toBe(true);
    expect(ctx.runtime?.onUpdate).toHaveBeenCalledWith("planning", "回忆相关上下文");
    expect(ctx.runtime?.onUpdate).toHaveBeenCalledWith("planning", "未命中相关记忆");
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

  it("skips duplicate retrieval when memoryStepStarted is already set", async () => {
    const provider = createMockProvider([
      {
        source: "viking://user/memories/pref.md",
        content: "User prefers TypeScript",
        layer: "L1",
        relevance: 0.9
      }
    ]);
    const middleware = new MemoryMiddleware(provider);
    const onUpdate = vi.fn();
    const ctx = createCtx({
      metadata: {
        memoryStepStarted: true
      },
      runtime: {
        config: {} as AppConfig,
        modelsFactory: {} as ModelsFactory,
        sandboxService: {} as SandboxService,
        onUpdate
      }
    });

    const result = await middleware.beforeLLM!(ctx);
    expect(result).toBe(ctx);
    expect(provider.injectContext).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalledWith("planning", "回忆相关上下文");
  });

  it("gracefully handles injectContext errors", async () => {
    const provider = createMockProvider();
    provider.injectContext.mockRejectedValueOnce(new Error("network down"));
    const middleware = new MemoryMiddleware(provider);
    const ctx = createCtx();
    const result = await middleware.beforeLLM!(ctx);

    expect(result.messages).toHaveLength(3);
    expect(result.messages[0].content).toContain("No relevant memory was retrieved");
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

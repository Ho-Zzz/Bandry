import { describe, expect, it, vi } from "vitest";
import { ResourceInjectionMiddleware } from "../resource-injection";
import type { MiddlewareContext } from "../types";

const createCtx = (overrides: Partial<MiddlewareContext> = {}): MiddlewareContext => ({
  sessionId: "s1",
  taskId: "t1",
  workspacePath: "/tmp/workspace",
  messages: [{ role: "user", content: "帮我分析 API 性能数据" }],
  tools: [],
  metadata: {},
  state: "before_agent",
  ...overrides
});

describe("ResourceInjectionMiddleware", () => {
  it("injects matching resources as system message", async () => {
    const mockStore = {
      search: vi.fn(async () => [
        {
          id: "r1",
          originalName: "api-perf.md",
          storedName: "document-r1.md",
          category: "document",
          summary: "API performance analysis report",
          relevance: 0.8,
          sourceTaskId: "t0",
          createdAt: "2026-01-01T00:00:00.000Z",
          tags: ["api", "performance"],
          sizeBytes: 500,
          meta: {}
        }
      ])
    };

    const middleware = new ResourceInjectionMiddleware(mockStore as never);
    const result = await middleware.beforeAgent!(createCtx());

    expect(mockStore.search).toHaveBeenCalledTimes(1);
    expect(mockStore.search).toHaveBeenCalledWith(
      expect.objectContaining({
        minRelevance: 0.3,
        limit: 5
      })
    );
    expect(result.messages).toHaveLength(2);
    expect(result.messages[0].role).toBe("system");
    expect(result.messages[0].content).toContain("api-perf.md");
    expect(result.metadata.resourceInjectionCount).toBe(1);
  });

  it("returns unchanged context when no resources match", async () => {
    const mockStore = {
      search: vi.fn(async () => [])
    };

    const middleware = new ResourceInjectionMiddleware(mockStore as never);
    const ctx = createCtx();
    const result = await middleware.beforeAgent!(ctx);

    expect(result.messages).toHaveLength(1);
    expect(result.metadata.resourceInjectionCount).toBeUndefined();
  });

  it("returns unchanged context when no user messages exist", async () => {
    const mockStore = {
      search: vi.fn(async () => [])
    };

    const middleware = new ResourceInjectionMiddleware(mockStore as never);
    const ctx = createCtx({ messages: [] });
    const result = await middleware.beforeAgent!(ctx);

    expect(mockStore.search).not.toHaveBeenCalled();
    expect(result).toBe(ctx);
  });

  it("filters English stop words from keywords", async () => {
    const mockStore = {
      search: vi.fn(async () => [])
    };

    const middleware = new ResourceInjectionMiddleware(mockStore as never);
    const ctx = createCtx({
      messages: [{ role: "user", content: "help me analyze the data" }]
    });
    await middleware.beforeAgent!(ctx);

    expect(mockStore.search).toHaveBeenCalledTimes(1);
    // "help", "me", "the" should be filtered; "analyze" and "data" should remain
    expect(mockStore.search).toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: expect.arrayContaining(["analyze", "data"])
      })
    );
    expect(mockStore.search).not.toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: expect.arrayContaining(["help"])
      })
    );
    expect(mockStore.search).not.toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: expect.arrayContaining(["me"])
      })
    );
    expect(mockStore.search).not.toHaveBeenCalledWith(
      expect.objectContaining({
        keywords: expect.arrayContaining(["the"])
      })
    );
  });

  it("handles store errors gracefully", async () => {
    const mockStore = {
      search: vi.fn(async () => {
        throw new Error("Store unavailable");
      })
    };

    const middleware = new ResourceInjectionMiddleware(mockStore as never);
    const ctx = createCtx();
    const result = await middleware.beforeAgent!(ctx);

    expect(result.messages).toHaveLength(1);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { MiddlewarePipeline } from "../pipeline";
import type { Middleware, MiddlewareContext } from "../types";

describe("MiddlewarePipeline", () => {
  let pipeline: MiddlewarePipeline;

  beforeEach(() => {
    pipeline = new MiddlewarePipeline();
  });

  it("should execute middlewares in registration order", async () => {
    const executionOrder: string[] = [];

    const middleware1: Middleware = {
      name: "middleware1",
      onRequest: async (ctx) => {
        executionOrder.push("middleware1-onRequest");
        return ctx;
      },
      beforeLLM: async (ctx) => {
        executionOrder.push("middleware1-beforeLLM");
        return ctx;
      }
    };

    const middleware2: Middleware = {
      name: "middleware2",
      onRequest: async (ctx) => {
        executionOrder.push("middleware2-onRequest");
        return ctx;
      },
      beforeLLM: async (ctx) => {
        executionOrder.push("middleware2-beforeLLM");
        return ctx;
      }
    };

    pipeline.use(middleware1);
    pipeline.use(middleware2);

    const initialContext: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {},
      state: "request"
    };

    const llmExecutor = async (ctx: MiddlewareContext) => {
      executionOrder.push("llm-execution");
      return { ...ctx, llmResponse: { content: "test response" } };
    };

    await pipeline.execute(initialContext, llmExecutor);

    expect(executionOrder).toEqual([
      "middleware1-onRequest",
      "middleware2-onRequest",
      "middleware1-beforeLLM",
      "middleware2-beforeLLM",
      "llm-execution"
    ]);
  });

  it("should pass context through middleware chain", async () => {
    const middleware1: Middleware = {
      name: "middleware1",
      onRequest: async (ctx) => {
        return {
          ...ctx,
          metadata: { ...ctx.metadata, middleware1: true }
        };
      }
    };

    const middleware2: Middleware = {
      name: "middleware2",
      beforeLLM: async (ctx) => {
        return {
          ...ctx,
          metadata: { ...ctx.metadata, middleware2: true }
        };
      }
    };

    pipeline.use(middleware1);
    pipeline.use(middleware2);

    const initialContext: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {},
      state: "request"
    };

    const llmExecutor = async (ctx: MiddlewareContext) => {
      return { ...ctx, llmResponse: { content: "test response" } };
    };

    const result = await pipeline.execute(initialContext, llmExecutor);

    expect(result.metadata.middleware1).toBe(true);
    expect(result.metadata.middleware2).toBe(true);
  });

  it("should execute all lifecycle hooks in correct order", async () => {
    const executionOrder: string[] = [];

    const middleware: Middleware = {
      name: "test-middleware",
      onRequest: async (ctx) => {
        executionOrder.push("onRequest");
        return ctx;
      },
      beforeLLM: async (ctx) => {
        executionOrder.push("beforeLLM");
        return ctx;
      },
      afterLLM: async (ctx) => {
        executionOrder.push("afterLLM");
        return ctx;
      },
      onResponse: async (ctx) => {
        executionOrder.push("onResponse");
        return ctx;
      }
    };

    pipeline.use(middleware);

    const initialContext: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {},
      state: "request"
    };

    const llmExecutor = async (ctx: MiddlewareContext) => {
      executionOrder.push("llm");
      return { ...ctx, llmResponse: { content: "test response" } };
    };

    await pipeline.execute(initialContext, llmExecutor);

    expect(executionOrder).toEqual([
      "onRequest",
      "beforeLLM",
      "llm",
      "afterLLM",
      "onResponse"
    ]);
  });

  it("should handle middleware errors gracefully", async () => {
    const middleware: Middleware = {
      name: "error-middleware",
      onRequest: async () => {
        throw new Error("Middleware error");
      }
    };

    pipeline.use(middleware);

    const initialContext: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {},
      state: "request"
    };

    const llmExecutor = async (ctx: MiddlewareContext) => ctx;

    await expect(pipeline.execute(initialContext, llmExecutor)).rejects.toThrow(
      "Middleware error-middleware failed at onRequest"
    );
  });

  it("should return middleware names", () => {
    const middleware1: Middleware = { name: "middleware1" };
    const middleware2: Middleware = { name: "middleware2" };

    pipeline.use(middleware1);
    pipeline.use(middleware2);

    expect(pipeline.getMiddlewareNames()).toEqual(["middleware1", "middleware2"]);
  });

  it("should clear all middlewares", () => {
    const middleware: Middleware = { name: "test-middleware" };
    pipeline.use(middleware);

    expect(pipeline.getMiddlewareNames()).toHaveLength(1);

    pipeline.clear();

    expect(pipeline.getMiddlewareNames()).toHaveLength(0);
  });

  it("should update context state through lifecycle", async () => {
    const states: string[] = [];

    const middleware: Middleware = {
      name: "state-tracker",
      onRequest: async (ctx) => {
        states.push(ctx.state);
        return ctx;
      },
      beforeLLM: async (ctx) => {
        states.push(ctx.state);
        return ctx;
      },
      afterLLM: async (ctx) => {
        states.push(ctx.state);
        return ctx;
      },
      onResponse: async (ctx) => {
        states.push(ctx.state);
        return ctx;
      }
    };

    pipeline.use(middleware);

    const initialContext: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {},
      state: "request"
    };

    const llmExecutor = async (ctx: MiddlewareContext) => {
      return { ...ctx, llmResponse: { content: "test" } };
    };

    await pipeline.execute(initialContext, llmExecutor);

    expect(states).toEqual(["request", "before_llm", "after_llm", "response"]);
  });
});

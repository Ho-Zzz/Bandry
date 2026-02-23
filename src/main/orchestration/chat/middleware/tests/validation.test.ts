import { describe, it, expect } from "vitest";
import { ValidationMiddleware } from "../validation";
import type { MiddlewareContext } from "../types";

describe("ValidationMiddleware", () => {
  it("should pass valid response", async () => {
    const middleware = new ValidationMiddleware(3);

    const ctx: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {},
      state: "after_llm",
      llmResponse: {
        content: "This is a valid response"
      }
    };

    const result = await middleware.afterLLM!(ctx);

    expect(result.metadata.validationPassed).toBe(true);
    expect(result.metadata.validationRetryCount).toBe(0);
  });

  it("should fail on empty response", async () => {
    const middleware = new ValidationMiddleware(3);

    const ctx: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {},
      state: "after_llm",
      llmResponse: {
        content: ""
      }
    };

    const result = await middleware.afterLLM!(ctx);

    expect(result.metadata.validationFailed).toBe(true);
    expect(result.metadata.validationFailureReason).toContain("Empty");
    expect(result.metadata.shouldRetry).toBe(true);
  });

  it("should fail on missing response", async () => {
    const middleware = new ValidationMiddleware(3);

    const ctx: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {},
      state: "after_llm"
    };

    const result = await middleware.afterLLM!(ctx);

    expect(result.metadata.validationFailed).toBe(true);
    expect(result.metadata.validationFailureReason).toContain("No LLM response");
  });

  it("should validate tool calls structure", async () => {
    const middleware = new ValidationMiddleware(3);

    const ctx: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {},
      state: "after_llm",
      llmResponse: {
        content: "Response with tool calls",
        toolCalls: [
          {
            name: "list_dir",
            arguments: { path: "/test" }
          }
        ]
      }
    };

    const result = await middleware.afterLLM!(ctx);

    expect(result.metadata.validationPassed).toBe(true);
  });

  it("should fail on invalid tool call structure", async () => {
    const middleware = new ValidationMiddleware(3);

    const ctx: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {},
      state: "after_llm",
      llmResponse: {
        content: "Response with invalid tool calls",
        toolCalls: [
          {
            name: "",
            arguments: {}
          } as any
        ]
      }
    };

    const result = await middleware.afterLLM!(ctx);

    expect(result.metadata.validationFailed).toBe(true);
    expect(result.metadata.validationFailureReason).toContain("Invalid tool call");
  });

  it("should validate JSON response when expected", async () => {
    const middleware = new ValidationMiddleware(3);

    const ctx: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {
        expectJsonResponse: true
      },
      state: "after_llm",
      llmResponse: {
        content: '{"key": "value"}'
      }
    };

    const result = await middleware.afterLLM!(ctx);

    expect(result.metadata.validationPassed).toBe(true);
  });

  it("should fail on invalid JSON when expected", async () => {
    const middleware = new ValidationMiddleware(3);

    const ctx: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {
        expectJsonResponse: true
      },
      state: "after_llm",
      llmResponse: {
        content: "not valid json"
      }
    };

    const result = await middleware.afterLLM!(ctx);

    expect(result.metadata.validationFailed).toBe(true);
    expect(result.metadata.validationFailureReason).toContain("Invalid JSON");
  });

  it("should throw after max retries", async () => {
    const middleware = new ValidationMiddleware(2);

    const ctx: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {
        validationRetryCount: 2
      },
      state: "after_llm",
      llmResponse: {
        content: ""
      }
    };

    await expect(middleware.afterLLM!(ctx)).rejects.toThrow(
      "Validation failed after 2 retries"
    );
  });

  it("should increment retry count", async () => {
    const middleware = new ValidationMiddleware(3);

    const ctx: MiddlewareContext = {
      sessionId: "test-session",
      taskId: "test-task",
      workspacePath: "/test/workspace",
      messages: [],
      tools: [],
      metadata: {
        validationRetryCount: 1
      },
      state: "after_llm",
      llmResponse: {
        content: ""
      }
    };

    const result = await middleware.afterLLM!(ctx);

    expect(result.metadata.validationRetryCount).toBe(2);
  });
});

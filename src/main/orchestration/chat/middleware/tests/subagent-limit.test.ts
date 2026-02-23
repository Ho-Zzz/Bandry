import { describe, expect, it } from "vitest";
import { SubagentLimitMiddleware } from "../subagent-limit";
import type { MiddlewareContext } from "../types";

describe("SubagentLimitMiddleware", () => {
  it("truncates delegated tasks above configured limit", async () => {
    const middleware = new SubagentLimitMiddleware(3);

    const ctx: MiddlewareContext = {
      sessionId: "s1",
      taskId: "t1",
      workspacePath: "/tmp/workspace",
      messages: [],
      tools: [],
      metadata: {},
      state: "after_model",
      llmResponse: {
        content: JSON.stringify({
          action: "tool",
          tool: "delegate_sub_tasks",
          input: {
            tasks: [
              { subTaskId: "sub_1", agentRole: "researcher", prompt: "p1", dependencies: [] },
              { subTaskId: "sub_2", agentRole: "writer", prompt: "p2", dependencies: [] },
              { subTaskId: "sub_3", agentRole: "writer", prompt: "p3", dependencies: [] },
              { subTaskId: "sub_4", agentRole: "bash_operator", prompt: "p4", dependencies: [] }
            ]
          }
        })
      }
    };

    const result = await middleware.afterModel!(ctx);
    const parsed = JSON.parse(result.llmResponse!.content) as {
      input: { tasks: unknown[] };
    };

    expect(parsed.input.tasks).toHaveLength(3);
    expect(result.metadata.subagentTruncatedCount).toBe(1);
  });
});

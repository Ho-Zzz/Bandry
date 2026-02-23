import { describe, expect, it } from "vitest";
import { MiddlewarePipeline } from "../pipeline";
import type { MiddlewareContext, Middleware } from "../types";
import type { PlannerActionTool } from "../../planner-types";

const createContext = (): MiddlewareContext => ({
  sessionId: "s1",
  taskId: "t1",
  workspacePath: "/tmp/w",
  messages: [],
  tools: [],
  metadata: {},
  state: "before_agent"
});

describe("wrapToolCall", () => {
  it("applies wrappers in middleware order", async () => {
    const pipeline = new MiddlewarePipeline();
    const order: string[] = [];

    const first: Middleware = {
      name: "first",
      wrapToolCall: async (ctx, action, next) => {
        order.push("first-before");
        const result = await next(ctx, action);
        order.push("first-after");
        return result;
      }
    };

    const second: Middleware = {
      name: "second",
      wrapToolCall: async (ctx, action, next) => {
        order.push("second-before");
        const result = await next(ctx, action);
        order.push("second-after");
        return result;
      }
    };

    pipeline.use(first);
    pipeline.use(second);

    const action: PlannerActionTool = {
      action: "tool",
      tool: "exec",
      input: {
        command: "ls"
      }
    };

    const observation = await pipeline.executeToolCall(createContext(), action, async () => {
      order.push("executor");
      return {
        tool: "exec",
        input: {},
        ok: true,
        output: "ok"
      };
    });

    expect(observation.ok).toBe(true);
    expect(order).toEqual([
      "first-before",
      "second-before",
      "executor",
      "second-after",
      "first-after"
    ]);
  });
});

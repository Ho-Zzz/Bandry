import type { Middleware, MiddlewareContext, ToolCallHandler } from "./types";
import type { PlannerActionTool, ToolObservation } from "../planner-types";

/**
 * Clarification middleware must remain the last middleware.
 * It can interrupt tool execution when planner explicitly asks for clarification.
 */
export class ClarificationMiddleware implements Middleware {
  name = "clarification";

  async wrapToolCall(
    ctx: MiddlewareContext,
    action: PlannerActionTool,
    next: ToolCallHandler
  ): Promise<ToolObservation> {
    if (action.tool === "ask_clarification") {
      const question = typeof action.input?.question === "string" ? action.input.question : "Need clarification";
      return {
        tool: "ask_clarification",
        input: action.input ?? {},
        ok: false,
        output: `Clarification required: ${question}`
      };
    }

    return await next(ctx, action);
  }
}

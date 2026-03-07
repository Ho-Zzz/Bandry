import type { Middleware, MiddlewareContext } from "./types";

/**
 * Patches inconsistent tool call payloads before model execution.
 */
export class DanglingToolCallMiddleware implements Middleware {
  name = "dangling_tool_call";

  async beforeModel(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    const toolCalls = ctx.llmResponse?.toolCalls;
    if (!toolCalls || toolCalls.length === 0) {
      return ctx;
    }

    const normalized = toolCalls.filter((call) => {
      return Boolean(
        call?.name &&
        typeof call.name === "string" &&
        call.name.trim().length > 0,
      );
    });

    if (normalized.length === toolCalls.length) {
      return ctx;
    }

    return {
      ...ctx,
      llmResponse: {
        ...ctx.llmResponse!,
        toolCalls: normalized,
      },
      metadata: {
        ...ctx.metadata,
        danglingToolCallsPatched:
          ((ctx.metadata.danglingToolCallsPatched as number | undefined) ?? 0) +
          1,
      },
    };
  }
}

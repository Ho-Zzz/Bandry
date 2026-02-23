import type { Middleware, MiddlewareContext } from "./types";

/**
 * Validation middleware
 * Validates LLM outputs and marks invalid responses for retry
 *
 * Currently validates:
 * - Response is not empty
 * - Tool calls have valid structure
 * - JSON responses are parseable (if expected)
 */
export class ValidationMiddleware implements Middleware {
  name = "validation";

  constructor(private maxRetries: number = 3) {}

  async afterLLM(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    const { llmResponse, metadata } = ctx;

    // Track retry count
    const retryCount = (metadata.validationRetryCount as number) || 0;

    // Validate response exists
    if (!llmResponse) {
      return this.markForRetry(ctx, "No LLM response received", retryCount);
    }

    // Validate content is not empty
    if (!llmResponse.content || llmResponse.content.trim().length === 0) {
      return this.markForRetry(ctx, "Empty LLM response content", retryCount);
    }

    // Validate tool calls structure if present
    if (llmResponse.toolCalls && Array.isArray(llmResponse.toolCalls)) {
      for (const toolCall of llmResponse.toolCalls) {
        if (!toolCall.name || typeof toolCall.name !== "string") {
          return this.markForRetry(ctx, "Invalid tool call: missing or invalid name", retryCount);
        }

        if (!toolCall.arguments || typeof toolCall.arguments !== "object") {
          return this.markForRetry(
            ctx,
            "Invalid tool call: missing or invalid arguments",
            retryCount
          );
        }
      }
    }

    // If expecting JSON response (indicated by metadata), validate it
    if (metadata.expectJsonResponse) {
      try {
        JSON.parse(llmResponse.content);
      } catch (error) {
        return this.markForRetry(
          ctx,
          `Invalid JSON response: ${error instanceof Error ? error.message : String(error)}`,
          retryCount
        );
      }
    }

    // Validation passed
    return {
      ...ctx,
      metadata: {
        ...metadata,
        validationPassed: true,
        validationRetryCount: retryCount
      }
    };
  }

  /**
   * Mark context for retry if under retry limit
   */
  private markForRetry(
    ctx: MiddlewareContext,
    reason: string,
    retryCount: number
  ): MiddlewareContext {
    const newRetryCount = retryCount + 1;

    if (newRetryCount > this.maxRetries) {
      throw new Error(
        `Validation failed after ${this.maxRetries} retries: ${reason}`
      );
    }

    console.warn(
      `[ValidationMiddleware] Validation failed (attempt ${newRetryCount}/${this.maxRetries}): ${reason}`
    );

    return {
      ...ctx,
      metadata: {
        ...ctx.metadata,
        validationFailed: true,
        validationFailureReason: reason,
        validationRetryCount: newRetryCount,
        shouldRetry: true
      }
    };
  }
}

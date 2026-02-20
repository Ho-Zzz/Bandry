import type { Middleware, MiddlewareContext, LlmExecutor } from "./types";

/**
 * Middleware pipeline orchestrator
 * Executes middleware hooks in sequence around LLM execution
 *
 * Execution order:
 * 1. onRequest hooks (all middlewares)
 * 2. beforeLLM hooks (all middlewares)
 * 3. LLM execution
 * 4. afterLLM hooks (all middlewares)
 * 5. onResponse hooks (all middlewares)
 */
export class MiddlewarePipeline {
  private middlewares: Middleware[] = [];

  /**
   * Register a middleware in the pipeline
   * Middlewares execute in registration order
   */
  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Execute the full middleware pipeline
   * @param initialContext - Starting context
   * @param llmExecutor - Function that executes the LLM request
   * @returns Final context after all hooks
   */
  async execute(
    initialContext: MiddlewareContext,
    llmExecutor: LlmExecutor
  ): Promise<MiddlewareContext> {
    let ctx = { ...initialContext };

    try {
      // Phase 1: onRequest hooks
      ctx.state = "request";
      ctx = await this.runHooks(ctx, "onRequest");

      // Phase 2: beforeLLM hooks
      ctx.state = "before_llm";
      ctx = await this.runHooks(ctx, "beforeLLM");

      // Phase 3: Execute LLM
      ctx = await llmExecutor(ctx);

      // Phase 4: afterLLM hooks
      ctx.state = "after_llm";
      ctx = await this.runHooks(ctx, "afterLLM");

      // Phase 5: onResponse hooks
      ctx.state = "response";
      ctx = await this.runHooks(ctx, "onResponse");

      return ctx;
    } catch (error) {
      // Add error to metadata for middleware inspection
      ctx.metadata.error = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Run all middleware hooks for a specific phase
   */
  private async runHooks(
    ctx: MiddlewareContext,
    hookName: keyof Middleware
  ): Promise<MiddlewareContext> {
    let currentCtx = ctx;

    for (const middleware of this.middlewares) {
      const hook = middleware[hookName];
      if (typeof hook === "function") {
        try {
          currentCtx = await hook(currentCtx);
        } catch (error) {
          // Log middleware error and re-throw
          console.error(`[MiddlewarePipeline] Error in ${middleware.name}.${hookName}:`, error);
          throw new Error(
            `Middleware ${middleware.name} failed at ${hookName}: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      }
    }

    return currentCtx;
  }

  /**
   * Get list of registered middleware names
   */
  getMiddlewareNames(): string[] {
    return this.middlewares.map((m) => m.name);
  }

  /**
   * Clear all registered middlewares
   */
  clear(): void {
    this.middlewares = [];
  }
}

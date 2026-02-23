import type {
  Middleware,
  MiddlewareContext,
  LlmExecutor,
  ToolCallHandler
} from "./types";
import type { PlannerActionTool, ToolObservation } from "../planner-types";

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
      // Full one-shot lifecycle for backward compatibility.
      ctx = await this.runBeforeAgent(ctx);
      ctx = await this.executeModel(ctx, llmExecutor);
      ctx = await this.runAfterAgent(ctx);

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
    hookName:
      | "beforeAgent"
      | "beforeModel"
      | "afterModel"
      | "afterAgent"
      | "onRequest"
      | "beforeLLM"
      | "afterLLM"
      | "onResponse"
  ): Promise<MiddlewareContext> {
    let currentCtx = ctx;

    for (const middleware of this.middlewares) {
      const hook = middleware[hookName];
      if (typeof hook === "function") {
        try {
          currentCtx = await hook.call(middleware, currentCtx);
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

  async runBeforeAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    let next: MiddlewareContext = { ...ctx, state: "before_agent" };
    next = await this.runHooks(next, "beforeAgent");
    // Legacy compatibility.
    next.state = "request";
    next = await this.runHooks(next, "onRequest");
    return next;
  }

  async runBeforeModel(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    let next: MiddlewareContext = { ...ctx, state: "before_model" };
    next = await this.runHooks(next, "beforeModel");
    // Legacy compatibility.
    next.state = "before_llm";
    next = await this.runHooks(next, "beforeLLM");
    return next;
  }

  async runAfterModel(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    let next: MiddlewareContext = { ...ctx, state: "after_model" };
    next = await this.runHooks(next, "afterModel");
    // Legacy compatibility.
    next.state = "after_llm";
    next = await this.runHooks(next, "afterLLM");
    return next;
  }

  async runAfterAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    let next: MiddlewareContext = { ...ctx, state: "after_agent" };
    next = await this.runHooks(next, "afterAgent");
    // Legacy compatibility.
    next.state = "response";
    next = await this.runHooks(next, "onResponse");
    return next;
  }

  async executeModel(
    initialContext: MiddlewareContext,
    llmExecutor: LlmExecutor
  ): Promise<MiddlewareContext> {
    let ctx = await this.runBeforeModel(initialContext);
    ctx = await llmExecutor(ctx);
    ctx = await this.runAfterModel(ctx);
    return ctx;
  }

  async executeToolCall(
    ctx: MiddlewareContext,
    action: PlannerActionTool,
    executor: ToolCallHandler
  ): Promise<ToolObservation> {
    const wrappers = this.middlewares
      .map((middleware) => {
        const wrapper = middleware.wrapToolCall;
        if (typeof wrapper !== "function") {
          return null;
        }
        return {
          wrapper,
          middleware
        };
      })
      .filter((item): item is { wrapper: NonNullable<Middleware["wrapToolCall"]>; middleware: Middleware } => Boolean(item));

    const composed = wrappers.reduceRight<ToolCallHandler>((next, item) => {
      return async (currentCtx, currentAction) => {
        return await item.wrapper.call(item.middleware, currentCtx, currentAction, next);
      };
    }, executor);

    return await composed(ctx, action);
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

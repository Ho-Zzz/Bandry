import type {
  Middleware,
  MiddlewareContext,
  LlmExecutor,
  ToolCallHandler
} from "./types";
import type { PlannerActionTool, ToolObservation } from "../planner-types";
import { runtimeLogger } from "../../../logging/runtime-logger";

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
        const startTime = Date.now();
        try {
          currentCtx = await hook.call(middleware, currentCtx);
          const duration = Date.now() - startTime;
          if (duration > 10) { // Only log if > 10ms
            runtimeLogger.info({
              module: "middleware",
              phase: String(hookName),
              traceId: currentCtx.sessionId,
              msg: `${middleware.name}.${hookName}`,
              durationMs: duration,
            });
          }
        } catch (error) {
          const duration = Date.now() - startTime;
          runtimeLogger.error({
            module: "middleware",
            phase: String(hookName),
            traceId: currentCtx.sessionId,
            msg: `Error in ${middleware.name}.${hookName}`,
            durationMs: duration,
            extra: {
              error: error instanceof Error ? error.message : String(error),
            },
          });
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
    const startTime = Date.now();
    let next: MiddlewareContext = { ...ctx, state: "before_agent" };
    next = await this.runHooks(next, "beforeAgent");
    // Legacy compatibility.
    next.state = "request";
    next = await this.runHooks(next, "onRequest");
    const duration = Date.now() - startTime;
    runtimeLogger.info({
      module: "pipeline",
      phase: "before_agent",
      traceId: next.sessionId,
      msg: "runBeforeAgent total",
      durationMs: duration,
    });
    return next;
  }

  async runBeforeModel(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    const startTime = Date.now();
    let next: MiddlewareContext = { ...ctx, state: "before_model" };
    next = await this.runHooks(next, "beforeModel");
    // Legacy compatibility.
    next.state = "before_llm";
    next = await this.runHooks(next, "beforeLLM");
    const duration = Date.now() - startTime;
    runtimeLogger.info({
      module: "pipeline",
      phase: "before_model",
      traceId: next.sessionId,
      msg: "runBeforeModel total",
      durationMs: duration,
    });
    return next;
  }

  async runAfterModel(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    const startTime = Date.now();
    let next: MiddlewareContext = { ...ctx, state: "after_model" };
    next = await this.runHooks(next, "afterModel");
    // Legacy compatibility.
    next.state = "after_llm";
    next = await this.runHooks(next, "afterLLM");
    const duration = Date.now() - startTime;
    runtimeLogger.info({
      module: "pipeline",
      phase: "after_model",
      traceId: next.sessionId,
      msg: "runAfterModel total",
      durationMs: duration,
    });
    return next;
  }

  async runAfterAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    const startTime = Date.now();
    let next: MiddlewareContext = { ...ctx, state: "after_agent" };
    next = await this.runHooks(next, "afterAgent");
    // Legacy compatibility.
    next.state = "response";
    next = await this.runHooks(next, "onResponse");
    const duration = Date.now() - startTime;
    runtimeLogger.info({
      module: "pipeline",
      phase: "after_agent",
      traceId: next.sessionId,
      msg: "runAfterAgent total",
      durationMs: duration,
    });
    return next;
  }

  async executeModel(
    initialContext: MiddlewareContext,
    llmExecutor: LlmExecutor
  ): Promise<MiddlewareContext> {
    const startTime = Date.now();
    let ctx = await this.runBeforeModel(initialContext);
    const beforeDuration = Date.now() - startTime;

    const llmStartTime = Date.now();
    ctx = await llmExecutor(ctx);
    const llmDuration = Date.now() - llmStartTime;
    runtimeLogger.info({
      module: "pipeline",
      phase: "llm_execution",
      traceId: ctx.sessionId,
      msg: "LLM execution",
      durationMs: llmDuration,
    });

    ctx = await this.runAfterModel(ctx);
    const totalDuration = Date.now() - startTime;
    runtimeLogger.info({
      module: "pipeline",
      phase: "execute_model",
      traceId: ctx.sessionId,
      msg: "executeModel total",
      durationMs: totalDuration,
      extra: {
        beforeMs: beforeDuration,
        llmMs: llmDuration,
        afterMs: totalDuration - beforeDuration - llmDuration,
      },
    });
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

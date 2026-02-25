import type { AppConfig } from "../../../config";
import type { ModelsFactory } from "../../../llm/runtime";
import type { SandboxService } from "../../../sandbox";
import type { ConversationStore } from "../../../persistence/sqlite";
import type { ChatMode } from "../../../../shared/ipc";
import { MiddlewarePipeline } from "./pipeline";
import type { Middleware } from "./types";
import { WorkspaceMiddleware } from "./workspace";
import { LocalResourceMiddleware } from "./local-resource";
import { SandboxBindingMiddleware } from "./sandbox-binding";
import { DanglingToolCallMiddleware } from "./dangling-tool-call";
import { SummarizationMiddleware } from "./summarization";
import { TitleMiddleware } from "./title";
import { SubagentLimitMiddleware } from "./subagent-limit";
import { ClarificationMiddleware } from "./clarification";
import { TodoListMiddleware } from "./todolist";

/**
 * Noop memory middleware placeholder.
 *
 * This is a placeholder for the memory queue functionality.
 * When implemented, it should:
 *
 * afterAgent hook:
 * 1. Filter messages to keep only user + final assistant messages
 * 2. Add filtered messages to a memory queue
 * 3. Process queue asynchronously (debounced)
 *
 * The actual MemoryMiddleware in ./memory.ts provides full implementation
 * when a MemoryProvider is available. This noop version is used when
 * memory is disabled or not configured.
 *
 * @see MemoryMiddleware for full implementation
 */
class NoopMemoryMiddleware implements Middleware {
  name = "memory";

  async afterAgent(ctx: import("./types").MiddlewareContext): Promise<import("./types").MiddlewareContext> {
    // Memory is disabled - no-op
    // When enabled, this would:
    // 1. Extract user message and final assistant response
    // 2. Queue for fact extraction and storage
    // 3. Return context unchanged (async processing)
    return ctx;
  }
}

export type MiddlewareLoaderOptions = {
  config: AppConfig;
  modelsFactory: ModelsFactory;
  sandboxService: SandboxService;
  conversationStore?: ConversationStore;
  /** Chat mode affects which middlewares are enabled */
  mode?: ChatMode;
};

/**
 * Build middleware stack based on mode.
 *
 * Middleware execution order (aligned with DeerFlow):
 * 1. WorkspaceMiddleware - Create task workspace
 * 2. LocalResourceMiddleware - Handle local resources
 * 3. SandboxBindingMiddleware - Bind sandbox context
 * 4. DanglingToolCallMiddleware - Fix dangling tool calls
 * 5. SummarizationMiddleware - Context compression (optional)
 * 6. TitleMiddleware - Title generation
 * 7. MemoryMiddleware - Memory queue (placeholder)
 * 8. TodoListMiddleware - Task list management (subagents mode only)
 * 9. SubagentLimitMiddleware - Concurrency limits (subagents mode only)
 * 10. ClarificationMiddleware - User clarification (must be last)
 */
export const buildMiddlewares = (options: MiddlewareLoaderOptions): Middleware[] => {
  const mode = options.mode ?? "default";

  const middlewares: Middleware[] = [
    new WorkspaceMiddleware(options.config.paths.workspacesDir),
    new LocalResourceMiddleware(),
    new SandboxBindingMiddleware(options.sandboxService),
    new DanglingToolCallMiddleware(),
    new SummarizationMiddleware(),
    new TitleMiddleware(),
    new NoopMemoryMiddleware()
  ];

  // Add mode-specific middlewares
  if (mode === "subagents") {
    middlewares.push(new TodoListMiddleware());
    middlewares.push(new SubagentLimitMiddleware());
  }

  // Clarification must always be last
  middlewares.push(new ClarificationMiddleware());

  const last = middlewares[middlewares.length - 1];
  if (!last || last.name !== "clarification") {
    throw new Error("ClarificationMiddleware must be the last middleware");
  }

  return middlewares;
};

export const createMiddlewarePipeline = (options: MiddlewareLoaderOptions): MiddlewarePipeline => {
  const pipeline = new MiddlewarePipeline();
  for (const middleware of buildMiddlewares(options)) {
    pipeline.use(middleware);
  }
  return pipeline;
};

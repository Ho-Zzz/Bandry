import type { AppConfig } from "../../../config";
import type { ModelsFactory } from "../../../llm/runtime";
import type { MemoryProvider } from "../../../memory/contracts/types";
import type { SandboxService } from "../../../sandbox";
import type { ConversationStore } from "../../../persistence/sqlite";
import type { ChatMode } from "../../../../shared/ipc";
import { ResourceStore } from "../../../resource-center";
import { MiddlewarePipeline } from "./pipeline";
import type { Middleware, MiddlewareContext } from "./types";
import { WorkspaceMiddleware } from "./workspace";
import { LocalResourceMiddleware } from "./local-resource";
import { ResourceInjectionMiddleware } from "./resource-injection";
import { SandboxBindingMiddleware } from "./sandbox-binding";
import { DanglingToolCallMiddleware } from "./dangling-tool-call";
import { SummarizationMiddleware } from "./summarization";
import { TitleMiddleware } from "./title";
import { MemoryMiddleware } from "./memory";
import { SubagentLimitMiddleware } from "./subagent-limit";
import { ResourceCurationMiddleware } from "./resource-curation";
import { ClarificationMiddleware } from "./clarification";
import { TodoListMiddleware } from "./todolist";
import { SoulSkillMiddleware } from "./soul-skill";

class NoopMemoryMiddleware implements Middleware {
  name = "memory";

  async afterAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    return ctx;
  }
}

export type MiddlewareLoaderOptions = {
  config: AppConfig;
  modelsFactory: ModelsFactory;
  sandboxService: SandboxService;
  conversationStore?: ConversationStore;
  memoryProvider?: MemoryProvider;
  mode?: ChatMode;
};

/**
 * Build middleware stack based on mode.
 *
 * Middleware execution order (aligned with DeerFlow):
 * 1. WorkspaceMiddleware - Create task workspace
 * 2. SoulSkillMiddleware - Inject soul persona and skills context
 * 3. LocalResourceMiddleware - Handle local resources
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
  const resourceStore = new ResourceStore(options.config.paths.resourcesDir);

  const memoryMiddleware = options.memoryProvider
    ? new MemoryMiddleware(options.memoryProvider)
    : new NoopMemoryMiddleware();

  const middlewares: Middleware[] = [
    new WorkspaceMiddleware(options.config.paths.workspacesDir),
    new SoulSkillMiddleware(options.config),
    new LocalResourceMiddleware(),
    new ResourceInjectionMiddleware(resourceStore),
    new SandboxBindingMiddleware(options.sandboxService),
    new DanglingToolCallMiddleware(),
    new SummarizationMiddleware(),
    new TitleMiddleware(),
    memoryMiddleware,
    new ResourceCurationMiddleware(resourceStore)
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

import type { AppConfig } from "../../../config";
import type { ModelsFactory } from "../../../llm/runtime";
import type { SandboxService } from "../../../sandbox";
import type { ConversationStore } from "../../../persistence/sqlite";
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

class NoopMemoryMiddleware implements Middleware {
  name = "memory";
}

export type MiddlewareLoaderOptions = {
  config: AppConfig;
  modelsFactory: ModelsFactory;
  sandboxService: SandboxService;
  conversationStore?: ConversationStore;
};

export const buildMiddlewares = (options: MiddlewareLoaderOptions): Middleware[] => {
  const middlewares: Middleware[] = [
    new WorkspaceMiddleware(options.config.paths.workspacesDir),
    new LocalResourceMiddleware(),
    new SandboxBindingMiddleware(options.sandboxService),
    new DanglingToolCallMiddleware(),
    new SummarizationMiddleware(),
    new TitleMiddleware(),
    new NoopMemoryMiddleware(),
    new SubagentLimitMiddleware(),
    new ClarificationMiddleware()
  ];

  // Clarification must always be last.
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

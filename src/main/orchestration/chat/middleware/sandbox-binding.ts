import type { SandboxService } from "../../../sandbox";
import type { Middleware, MiddlewareContext } from "./types";

/**
 * Binds sandbox operations to the task workspace for the lifetime of a request.
 */
export class SandboxBindingMiddleware implements Middleware {
  name = "sandbox_binding";

  constructor(private readonly sandboxService: SandboxService) {}

  async beforeAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    if (ctx.workspacePath && typeof this.sandboxService.setWorkspaceContext === "function") {
      this.sandboxService.setWorkspaceContext(ctx.taskId, ctx.workspacePath);
    }
    return ctx;
  }

  async afterAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    if (typeof this.sandboxService.clearWorkspaceContext === "function") {
      this.sandboxService.clearWorkspaceContext();
    }
    return ctx;
  }
}

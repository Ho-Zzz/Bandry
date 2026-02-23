import * as fs from "fs/promises";
import * as path from "path";
import type { Middleware, MiddlewareContext } from "./types";

/**
 * Workspace middleware
 * Allocates and manages task-specific workspace directories
 *
 * Directory structure:
 * ~/.bandry/workspaces/task_{taskId}/
 *   ├── input/     - User-provided input files
 *   ├── staging/   - Intermediate processing files
 *   └── output/    - Final deliverables
 */
export class WorkspaceMiddleware implements Middleware {
  name = "workspace";

  constructor(private baseWorkspacePath: string) {}

  async beforeAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    return this.onRequest(ctx);
  }

  async onRequest(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    // Generate workspace path for this task
    const workspacePath = path.join(this.baseWorkspacePath, `task_${ctx.taskId}`);

    // Create workspace directories
    await this.ensureWorkspaceStructure(workspacePath);

    // Inject workspace path into context
    return {
      ...ctx,
      workspacePath,
      metadata: {
        ...ctx.metadata,
        workspaceCreated: true,
        workspaceStructure: {
          input: path.join(workspacePath, "input"),
          staging: path.join(workspacePath, "staging"),
          output: path.join(workspacePath, "output")
        }
      }
    };
  }

  /**
   * Create workspace directory structure
   */
  private async ensureWorkspaceStructure(workspacePath: string): Promise<void> {
    const subdirs = ["input", "staging", "output"];

    try {
      // Create base workspace directory
      await fs.mkdir(workspacePath, { recursive: true });

      // Create subdirectories
      for (const subdir of subdirs) {
        await fs.mkdir(path.join(workspacePath, subdir), { recursive: true });
      }
    } catch (error) {
      throw new Error(
        `Failed to create workspace structure at ${workspacePath}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Clean up old workspaces (utility method, not called by pipeline)
   * Can be called periodically to remove old task workspaces
   */
  async cleanupOldWorkspaces(maxAgeMs: number): Promise<number> {
    try {
      const entries = await fs.readdir(this.baseWorkspacePath, { withFileTypes: true });
      const now = Date.now();
      let cleaned = 0;

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith("task_")) {
          const taskPath = path.join(this.baseWorkspacePath, entry.name);
          const stats = await fs.stat(taskPath);
          const age = now - stats.mtimeMs;

          if (age > maxAgeMs) {
            await fs.rm(taskPath, { recursive: true, force: true });
            cleaned++;
          }
        }
      }

      return cleaned;
    } catch (error) {
      console.error("[WorkspaceMiddleware] Failed to cleanup old workspaces:", error);
      return 0;
    }
  }
}

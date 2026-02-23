import fs from "node:fs/promises";
import path from "node:path";
import type { Middleware, MiddlewareContext } from "./types";

/**
 * Reads task input directory metadata and places it into middleware metadata.
 */
export class LocalResourceMiddleware implements Middleware {
  name = "local_resource";

  async beforeAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    if (!ctx.workspacePath) {
      return ctx;
    }

    const inputDir = path.join(ctx.workspacePath, "input");
    try {
      const entries = await fs.readdir(inputDir, { withFileTypes: true });
      return {
        ...ctx,
        metadata: {
          ...ctx.metadata,
          localResourceInputFiles: entries.filter((item) => item.isFile()).map((item) => item.name)
        }
      };
    } catch {
      return ctx;
    }
  }
}

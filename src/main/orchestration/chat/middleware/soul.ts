import type { Middleware, MiddlewareContext } from "./types";
import type { AppConfig } from "../../../config";
import { loadSoulContext, buildSoulPromptContent } from "../../../soul";

/**
 * Soul middleware.
 * Loads SOUL.md/IDENTITY.md and injects persona content as a system message
 * before each LLM call.
 *
 * Uses beforeLLM hook (not beforeAgent) because the chat agent
 * rebuilds ctx.messages before each LLM call, which would discard
 * anything injected during beforeAgent.
 *
 * Content is cached after first load to avoid repeated IO.
 */
export class SoulMiddleware implements Middleware {
  name = "soul";

  private cached: string | null = null;

  constructor(private readonly config: AppConfig) {}

  clearCache(): void {
    this.cached = null;
  }

  async beforeLLM(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    if (this.cached === null) {
      this.cached = await this.loadAndBuild();
    }

    if (!this.cached) return ctx;

    return {
      ...ctx,
      messages: [{ role: "system", content: this.cached }, ...ctx.messages],
      metadata: {
        ...ctx.metadata,
        soulInjected: true
      }
    };
  }

  private async loadAndBuild(): Promise<string> {
    try {
      if (this.config.features.enableSoul) {
        const soulCtx = await loadSoulContext(this.config.paths.soulDir);
        return buildSoulPromptContent(soulCtx);
      }
    } catch (error) {
      console.error("[SoulMiddleware] Failed to load soul:", error);
    }
    return "";
  }
}

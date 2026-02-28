import type { Middleware, MiddlewareContext } from "./types";
import type { AppConfig } from "../../../config";
import { loadSoulContext, buildSoulPromptContent } from "../../../soul";
import { loadSkillsFromDir } from "../../../skills/skill-loader";
import { buildSkillsPromptContent } from "../../../skills/skill-prompt-builder";
import { BUNDLED_SKILLS } from "../../../skills/bundled-skills";
import type { SkillEntry } from "../../../skills/types";

/**
 * Soul & Skills middleware.
 * Loads SOUL.md/IDENTITY.md and SKILL.md files,
 * then injects their content as system messages before each LLM call.
 *
 * Uses beforeLLM hook (not beforeAgent) because the chat agent
 * rebuilds ctx.messages before each LLM call, which would discard
 * anything injected during beforeAgent.
 *
 * Bundled skills are embedded in code (no filesystem dependency).
 * User skills from ~/.bandry/skills/ override bundled ones by name.
 * Content is cached after first load to avoid repeated IO.
 */
export class SoulSkillMiddleware implements Middleware {
  name = "soul_skill";

  private cached: { soul: string; skills: string } | null = null;

  constructor(private readonly config: AppConfig) {}

  clearCache(): void {
    this.cached = null;
  }

  async beforeLLM(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    if (!this.cached) {
      this.cached = await this.loadAndBuild();
    }

    const injections: Array<{ role: "system"; content: string }> = [];

    if (this.cached.soul) {
      injections.push({ role: "system", content: this.cached.soul });
    }
    if (this.cached.skills) {
      injections.push({ role: "system", content: this.cached.skills });
    }

    if (injections.length === 0) return ctx;

    return {
      ...ctx,
      messages: [...injections, ...ctx.messages],
      metadata: {
        ...ctx.metadata,
        soulInjected: !!this.cached.soul,
        skillsInjected: !!this.cached.skills
      }
    };
  }

  private async loadAndBuild(): Promise<{ soul: string; skills: string }> {
    let soul = "";
    let skills = "";

    try {
      if (this.config.features.enableSoul) {
        const soulCtx = await loadSoulContext(this.config.paths.soulDir);
        soul = buildSoulPromptContent(soulCtx);
      }
    } catch (error) {
      console.error("[SoulSkillMiddleware] Failed to load soul:", error);
    }

    try {
      if (this.config.features.enableSkills) {
        // Merge bundled skills (embedded in code) with user skills (from filesystem)
        const merged = new Map<string, SkillEntry>();
        for (const skill of BUNDLED_SKILLS) {
          merged.set(skill.name, skill);
        }
        // User skills override bundled ones by name
        const userSkills = await loadSkillsFromDir(this.config.paths.skillsDir);
        for (const skill of userSkills) {
          merged.set(skill.name, skill);
        }
        skills = buildSkillsPromptContent(Array.from(merged.values()));
      }
    } catch (error) {
      console.error("[SoulSkillMiddleware] Failed to load skills:", error);
    }

    return { soul, skills };
  }
}

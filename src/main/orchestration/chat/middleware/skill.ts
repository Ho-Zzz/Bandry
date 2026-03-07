import type { Middleware, MiddlewareContext } from "./types";
import type { AppConfig } from "../../../config";
import { loadSkillsFromDir } from "../../../skills/skill-loader";
import { buildSkillsPromptContent } from "../../../skills/skill-prompt-builder";
import { BUNDLED_SKILLS } from "../../../skills/bundled-skills";
import type { SkillEntry } from "../../../skills/types";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Skill middleware.
 * Loads bundled and user SKILL.md files, then injects their content
 * as a system message before each LLM call.
 *
 * Uses beforeLLM hook (not beforeAgent) because the chat agent
 * rebuilds ctx.messages before each LLM call, which would discard
 * anything injected during beforeAgent.
 *
 * Bundled skills are embedded in code (no filesystem dependency).
 * User skills from ~/.bandry/skills/ override bundled ones by name.
 * Content is cached after first load to avoid repeated IO.
 */
export class SkillMiddleware implements Middleware {
  name = "skill";

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
        skillsInjected: true
      }
    };
  }

  private async loadAndBuild(): Promise<string> {
    try {
      if (this.config.features.enableSkills) {
        const disabledSet = await this.loadDisabledSet();
        const merged = new Map<string, SkillEntry>();
        for (const skill of BUNDLED_SKILLS) {
          if (!disabledSet.has(skill.name)) {
            merged.set(skill.name, skill);
          }
        }
        const userSkills = await loadSkillsFromDir(this.config.paths.skillsDir);
        for (const skill of userSkills) {
          if (disabledSet.has(skill.name)) {
            merged.delete(skill.name);
          } else {
            merged.set(skill.name, skill);
          }
        }
        return buildSkillsPromptContent(Array.from(merged.values()));
      }
    } catch (error) {
      console.error("[SkillMiddleware] Failed to load skills:", error);
    }
    return "";
  }

  private async loadDisabledSet(): Promise<Set<string>> {
    try {
      const raw = await fs.readFile(path.join(this.config.paths.skillsDir, ".config.json"), "utf-8");
      const config = JSON.parse(raw) as Record<string, boolean>;
      return new Set(Object.entries(config).filter(([, v]) => v === false).map(([k]) => k));
    } catch {
      return new Set();
    }
  }
}

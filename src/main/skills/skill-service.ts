import fs from "node:fs/promises";
import path from "node:path";
import type { SkillItem, SkillCreateInput, SkillUpdateInput, SkillOperationResult, SkillToggleInput } from "../../shared/ipc";
import { BUNDLED_SKILLS } from "./bundled-skills";
import { loadSkillsFromDir } from "./skill-loader";
import { parseSkillFrontmatter } from "./frontmatter-parser";

const SKILL_FILENAME = "SKILL.md";
const CONFIG_FILENAME = ".config.json";

type SkillConfig = Record<string, boolean>;

const buildSkillMd = (name: string, description: string, tags: string[], content: string): string => {
  const tagLine = tags.length > 0 ? `\ntags: ${tags.join(", ")}` : "";
  return `---\nname: ${name}\ndescription: ${description}${tagLine}\n---\n\n${content}\n`;
};

export class SkillService {
  constructor(private readonly skillsDir: string) {}

  private async loadConfig(): Promise<SkillConfig> {
    try {
      const raw = await fs.readFile(path.join(this.skillsDir, CONFIG_FILENAME), "utf-8");
      return JSON.parse(raw) as SkillConfig;
    } catch {
      return {};
    }
  }

  private async saveConfig(config: SkillConfig): Promise<void> {
    await fs.mkdir(this.skillsDir, { recursive: true });
    await fs.writeFile(path.join(this.skillsDir, CONFIG_FILENAME), JSON.stringify(config, null, 2), "utf-8");
  }

  async list(): Promise<SkillItem[]> {
    const config = await this.loadConfig();

    const items: SkillItem[] = BUNDLED_SKILLS.map((s) => ({
      name: s.name,
      description: s.description,
      tags: s.tags,
      content: s.content,
      isBundled: true,
      enabled: config[s.name] !== false
    }));

    const userSkills = await loadSkillsFromDir(this.skillsDir);
    const merged = new Map<string, SkillItem>();
    for (const item of items) {
      merged.set(item.name, item);
    }
    for (const s of userSkills) {
      merged.set(s.name, {
        name: s.name,
        description: s.description,
        tags: s.tags,
        content: s.content,
        isBundled: false,
        enabled: config[s.name] !== false
      });
    }

    return Array.from(merged.values());
  }

  async create(input: SkillCreateInput): Promise<SkillOperationResult> {
    const skillDir = path.join(this.skillsDir, input.name);
    const skillPath = path.join(skillDir, SKILL_FILENAME);

    try {
      await fs.stat(skillPath);
      return { ok: false, message: `Skill "${input.name}" already exists` };
    } catch {
      // Does not exist, good
    }

    await fs.mkdir(skillDir, { recursive: true });
    const md = buildSkillMd(input.name, input.description, input.tags, input.content);
    await fs.writeFile(skillPath, md, "utf-8");

    return { ok: true, message: `Skill "${input.name}" created` };
  }

  async update(name: string, input: SkillUpdateInput): Promise<SkillOperationResult> {
    const skillPath = path.join(this.skillsDir, name, SKILL_FILENAME);

    let raw: string;
    try {
      raw = await fs.readFile(skillPath, "utf-8");
    } catch {
      return { ok: false, message: `Skill "${name}" not found in user directory` };
    }

    const { frontmatter, body } = parseSkillFrontmatter(raw);
    const newDesc = input.description ?? frontmatter?.description ?? "";
    const newTags = input.tags ?? frontmatter?.tags ?? [];
    const newContent = input.content ?? body;

    const md = buildSkillMd(name, newDesc, newTags, newContent);
    await fs.writeFile(skillPath, md, "utf-8");

    return { ok: true, message: `Skill "${name}" updated` };
  }

  async delete(name: string): Promise<SkillOperationResult> {
    const skillDir = path.join(this.skillsDir, name);
    try {
      await fs.rm(skillDir, { recursive: true, force: true });
      return { ok: true, message: `Skill "${name}" deleted` };
    } catch {
      return { ok: false, message: `Failed to delete skill "${name}"` };
    }
  }

  async toggle(input: SkillToggleInput): Promise<SkillOperationResult> {
    const config = await this.loadConfig();
    if (input.enabled) {
      delete config[input.name];
    } else {
      config[input.name] = false;
    }
    await this.saveConfig(config);
    return { ok: true, message: `Skill "${input.name}" ${input.enabled ? "enabled" : "disabled"}` };
  }
}

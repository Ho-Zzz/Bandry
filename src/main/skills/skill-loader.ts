import fs from "node:fs/promises";
import path from "node:path";
import type { SkillEntry } from "./types";
import { parseSkillFrontmatter } from "./frontmatter-parser";

const SKILL_FILENAME = "SKILL.md";
const MAX_SKILL_BYTES = 256_000;

const readDirSafe = async (dirPath: string): Promise<string[]> => {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
};

const isDirectory = async (dirPath: string): Promise<boolean> => {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
};

/**
 * Load all skills from a directory.
 * Expects structure: dir/skill-name/SKILL.md
 */
export const loadSkillsFromDir = async (dir: string): Promise<SkillEntry[]> => {
  const entries = await readDirSafe(dir);
  const skills: SkillEntry[] = [];

  for (const entry of entries) {
    const skillDir = path.join(dir, entry);
    if (!await isDirectory(skillDir)) continue;

    const skillPath = path.join(skillDir, SKILL_FILENAME);
    let raw: string;
    try {
      const stat = await fs.stat(skillPath);
      if (stat.size > MAX_SKILL_BYTES) {
        console.warn(`[Skills] Skipping ${entry}: SKILL.md exceeds ${MAX_SKILL_BYTES} bytes`);
        continue;
      }
      raw = await fs.readFile(skillPath, "utf-8");
    } catch {
      continue;
    }

    const { frontmatter, body } = parseSkillFrontmatter(raw);
    if (!frontmatter) {
      console.warn(`[Skills] Skipping ${entry}: missing name or description in frontmatter`);
      continue;
    }

    skills.push({
      name: frontmatter.name,
      description: frontmatter.description,
      tags: frontmatter.tags ?? [],
      content: body,
      sourcePath: skillPath
    });
  }

  return skills;
};

/**
 * Load skills from multiple directories, later sources override earlier ones.
 */
export const loadAllSkills = async (dirs: string[]): Promise<SkillEntry[]> => {
  const merged = new Map<string, SkillEntry>();

  for (const dir of dirs) {
    const skills = await loadSkillsFromDir(dir);
    for (const skill of skills) {
      merged.set(skill.name, skill);
    }
  }

  return Array.from(merged.values());
};

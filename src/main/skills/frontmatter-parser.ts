import type { SkillFrontmatter } from "./types";

export const parseSkillFrontmatter = (raw: string): { frontmatter: SkillFrontmatter | null; body: string } => {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: null, body: raw };
  }

  const block = match[1];
  const body = (match[2] ?? "").trim();
  const fields: Record<string, string> = {};

  for (const line of block.split("\n")) {
    const kv = line.match(/^\s*(\w[\w-]*)\s*:\s*(.+)/);
    if (kv) {
      fields[kv[1]] = kv[2].trim();
    }
  }

  const name = fields.name;
  const description = fields.description;
  if (!name || !description) {
    return { frontmatter: null, body: raw };
  }

  const tags = fields.tags
    ? fields.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  return {
    frontmatter: { name, description, tags },
    body
  };
};

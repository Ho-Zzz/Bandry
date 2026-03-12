import fs from "node:fs/promises";
import path from "node:path";
import type { SoulContext, IdentityData } from "./types";

const SOUL_FILENAME = "SOUL.md";
const IDENTITY_FILENAME = "IDENTITY.md";

const parseIdentityFrontmatter = (raw: string): { name?: string; tagline?: string } => {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  const block = match[1];
  const result: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const kv = line.match(/^\s*(\w+)\s*:\s*(.+)/);
    if (kv) {
      result[kv[1]] = kv[2].trim();
    }
  }
  return { name: result.name, tagline: result.tagline };
};

const readFileSafe = async (filePath: string): Promise<string | null> => {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
};

export const loadSoulContext = async (soulDir: string): Promise<SoulContext> => {
  const ctx: SoulContext = {};

  const soulContent = await readFileSafe(path.join(soulDir, SOUL_FILENAME));
  if (soulContent && soulContent.trim().length > 0) {
    ctx.soul = { content: soulContent };
  }

  const identityContent = await readFileSafe(path.join(soulDir, IDENTITY_FILENAME));
  if (identityContent && identityContent.trim().length > 0) {
    const fm = parseIdentityFrontmatter(identityContent);
    const identity: IdentityData = {
      name: fm.name ?? "Bandry",
      tagline: fm.tagline,
      content: identityContent.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "").trim()
    };
    ctx.identity = identity;
  }

  return ctx;
};

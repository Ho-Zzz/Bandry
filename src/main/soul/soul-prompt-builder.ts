import type { SoulContext } from "./types";
import { buildSection, joinSections } from "../orchestration/chat/prompts/template-engine";

const MAX_SOUL_CHARS = 20_000;

export const buildSoulPromptContent = (ctx: SoulContext): string => {
  const parts: string[] = [];

  if (ctx.identity) {
    const lines = [`Name: ${ctx.identity.name}`];
    if (ctx.identity.tagline) {
      lines.push(`Tagline: ${ctx.identity.tagline}`);
    }
    if (ctx.identity.content) {
      lines.push("", ctx.identity.content);
    }
    parts.push(buildSection("identity", lines.join("\n")));
  }

  if (ctx.soul) {
    const content = ctx.soul.content.length > MAX_SOUL_CHARS
      ? ctx.soul.content.slice(0, MAX_SOUL_CHARS) + "\n[...truncated]"
      : ctx.soul.content;

    parts.push(buildSection("soul", [
      content,
      "",
      "IMPORTANT: Embody the persona and tone defined above throughout your responses."
    ].join("\n")));
  }

  return joinSections(...parts);
};

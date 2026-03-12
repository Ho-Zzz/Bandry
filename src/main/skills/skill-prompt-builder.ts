import type { SkillEntry } from "./types";
import { buildSection } from "../orchestration/chat/prompts/template-engine";

const MAX_SKILLS_PROMPT_CHARS = 30_000;
const MAX_SKILLS_IN_PROMPT = 50;

export const buildSkillsPromptContent = (skills: SkillEntry[]): string => {
  if (skills.length === 0) return "";

  const lines: string[] = [
    "# Available Skills",
    "",
    "The following skills are loaded. When a user request matches a skill, follow its guidance.",
    ""
  ];

  let totalChars = lines.join("\n").length;
  let count = 0;

  for (const skill of skills) {
    if (count >= MAX_SKILLS_IN_PROMPT) break;

    const skillBlock = [
      `## ${skill.name}`,
      `> ${skill.description}`,
      ...(skill.tags.length > 0 ? [`Tags: ${skill.tags.join(", ")}`] : []),
      "",
      skill.content,
      ""
    ].join("\n");

    if (totalChars + skillBlock.length > MAX_SKILLS_PROMPT_CHARS) break;

    lines.push(skillBlock);
    totalChars += skillBlock.length;
    count += 1;
  }

  return buildSection("skills", lines.join("\n"));
};

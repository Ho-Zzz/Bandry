import { buildSection } from "../template-engine";

/**
 * Build the critical reminders section
 * @param subagentReminder Additional reminder for subagents mode
 */
export const buildCriticalRemindersSection = (subagentReminder: string = ""): string => {
  const lines = [
    "- **Clarification First**: ALWAYS clarify unclear/missing/ambiguous requirements BEFORE starting work - never assume or guess"
  ];

  if (subagentReminder) {
    lines.push(subagentReminder);
  }

  lines.push(
    "- **Tool Selection**: Use github_search for GitHub, web_search for general web, web_fetch for specific URLs",
    "- **Language Consistency**: Respond in the same language as the user's input",
    "- **One Tool Per Step**: Execute one tool at a time, analyze results before next action",
    "- **Safety First**: Never execute dangerous commands or access files outside workspace"
  );

  return buildSection("critical_reminders", lines.join("\n"));
};

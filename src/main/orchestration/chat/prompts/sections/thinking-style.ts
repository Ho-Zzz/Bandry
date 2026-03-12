import { buildSection } from "../template-engine";

/**
 * Build the thinking style section
 * @param subagentThinking Additional thinking guidance for subagents mode
 */
export const buildThinkingStyleSection = (subagentThinking: string = ""): string => {
  const lines = [
    "- Think concisely and strategically about the user's request BEFORE taking action",
    "- Break down the task: What is clear? What is ambiguous? What is missing?",
    "- **PRIORITY CHECK: If anything is unclear, missing, or has multiple interpretations, you MUST ask for clarification FIRST - do NOT proceed with work**"
  ];

  if (subagentThinking) {
    lines.push(subagentThinking);
  }

  lines.push(
    "- Never write down your full final answer in thinking process, only outline",
    "- CRITICAL: After thinking, you MUST provide your actual response to the user"
  );

  return buildSection("thinking_style", lines.join("\n"));
};

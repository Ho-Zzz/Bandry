import type { PromptVariables } from "../types";
import { buildSection, joinSections } from "../template-engine";
import {
  buildRoleSection,
  buildThinkingStyleSection,
  buildClarificationSystemSection,
  buildToolSelectionSection,
  buildWorkingDirectorySection,
  buildResponseStyleSection,
  buildCitationsSection,
  buildCriticalRemindersSection
} from "../sections";

/**
 * Build the output format section for planner
 */
const buildOutputFormatSection = (enabledTools: string): string => {
  const content = `You MUST output JSON only with one object and no extra text.

Allowed actions:
- {"action":"answer","answer":"..."} - Direct answer without tools
- {"action":"tool","tool":"<tool_name>","input":{...},"reason":"..."} - Execute a tool

Available tools: ${enabledTools}

Rules:
- Use at most one tool per step
- Include "reason" field to explain tool choice
- For greetings or simple Q&A, always use action=answer
- For GitHub searches, ALWAYS use github_search tool
- For general web searches, use web_search tool`;

  return buildSection("output_format", content);
};

/**
 * Build the memory context section if provided
 */
const buildMemoryContextSection = (memoryContext: string): string => {
  if (!memoryContext.trim()) {
    return "";
  }
  return buildSection("memory_context", memoryContext);
};

/**
 * Build the current date section
 */
const buildCurrentDateSection = (currentDate: string): string => {
  return buildSection("current_date", currentDate);
};

const buildPersistRequirementSection = (persistRequired: boolean, persistPathHint: string): string => {
  if (!persistRequired) {
    return "";
  }

  const content = [
    "This request explicitly requires persisted document output.",
    "Before final answer, you MUST call write_file at least once and it must succeed.",
    `Preferred output path: ${persistPathHint || "/mnt/workspace/output/<file>.md"}`,
    "Allowed write location: /mnt/workspace/output/** only.",
    "If target file already exists, use ask_clarification to ask user for a new path. Do NOT overwrite."
  ].join("\n");

  return buildSection("persist_requirement", content);
};

/**
 * Extended thinking guidance for thinking mode
 */
const THINKING_MODE_GUIDANCE = `- Consider multiple approaches before deciding
- Validate assumptions before tool execution
- Break down complex problems into steps`;

/**
 * Build the thinking mode planner prompt (deep reasoning)
 */
export const buildThinkingPlannerPrompt = (vars: PromptVariables): string => {
  return joinSections(
    buildRoleSection(),
    buildMemoryContextSection(vars.memoryContext),
    buildThinkingStyleSection(THINKING_MODE_GUIDANCE),
    buildClarificationSystemSection(),
    buildToolSelectionSection(),
    buildWorkingDirectorySection(vars.virtualRoot, vars.allowedCommands),
    buildResponseStyleSection(vars.userLanguage),
    buildCitationsSection(),
    buildPersistRequirementSection(vars.persistRequired, vars.persistPathHint),
    buildOutputFormatSection(vars.enabledTools),
    buildCriticalRemindersSection(),
    buildCurrentDateSection(vars.currentDate)
  );
};

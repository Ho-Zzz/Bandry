import type { PromptVariables } from "../types";
import { buildSection, joinSections } from "../template-engine";
import {
  buildRoleSection,
  buildThinkingStyleSection,
  buildClarificationSystemSection,
  buildSubagentSystemSection,
  buildToolSelectionSection,
  buildWorkingDirectorySection,
  buildResponseStyleSection,
  buildCitationsSection,
  buildCriticalRemindersSection
} from "../sections";

/**
 * Build the output format section for subagents mode planner
 */
const buildSubagentsOutputFormatSection = (enabledTools: string): string => {
  const content = `You MUST output JSON only with one object and no extra text.

Allowed actions:
- {"action":"answer","answer":"..."} - Direct answer without tools
- {"action":"tool","tool":"<tool_name>","input":{...},"reason":"..."} - Execute a tool

Available tools: ${enabledTools}

Rules:
- Use at most one tool per step (except for parallel \`task\` calls in subagents mode)
- Include "reason" field to explain tool choice
- For greetings or simple Q&A, always use action=answer
- For GitHub searches, ALWAYS use github_search tool
- For general web searches, use web_search tool
- In subagents mode, you may output multiple \`task\` tool calls for parallel execution`;

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

/**
 * Build subagent-specific thinking guidance
 */
const buildSubagentThinkingGuidance = (maxSubTasks: number): string => {
  return `- **DECOMPOSITION CHECK: Can this task be broken into 2+ parallel sub-tasks? If YES, COUNT them. If count > ${maxSubTasks}, you MUST plan batches of ≤${maxSubTasks} and only launch the FIRST batch now.**`;
};

/**
 * Build subagent-specific reminder
 */
const buildSubagentReminder = (maxSubTasks: number): string => {
  return `- **Orchestrator Mode**: You are a task orchestrator - decompose complex tasks into parallel sub-tasks. **HARD LIMIT: max ${maxSubTasks} \`task\` calls per response.**`;
};

/**
 * Build the subagents mode planner prompt (multi-agent collaboration)
 */
export const buildSubagentsPlannerPrompt = (vars: PromptVariables): string => {
  const n = vars.maxSubTasks;

  return joinSections(
    buildRoleSection(),
    buildMemoryContextSection(vars.memoryContext),
    buildThinkingStyleSection(buildSubagentThinkingGuidance(n)),
    buildClarificationSystemSection(),
    buildSubagentSystemSection(n),
    buildToolSelectionSection(),
    buildWorkingDirectorySection(vars.virtualRoot, vars.allowedCommands),
    buildResponseStyleSection(vars.userLanguage),
    buildCitationsSection(),
    buildSubagentsOutputFormatSection(vars.enabledTools),
    buildCriticalRemindersSection(buildSubagentReminder(n)),
    buildCurrentDateSection(vars.currentDate)
  );
};

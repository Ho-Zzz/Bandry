import type { AppConfig } from "../../../config";
import type { ChatMode } from "../../../../shared/ipc";
import type { PromptVariables, PromptBuildOptions } from "./types";
import { detectLanguage } from "./language-detector";
import {
  buildDefaultPlannerPrompt,
  buildThinkingPlannerPrompt,
  buildSubagentsPlannerPrompt,
  buildSynthesizerPrompt
} from "./templates";

/**
 * Build the list of enabled tools based on config
 */
const buildEnabledToolsList = (config: AppConfig, mode: ChatMode): string[] => {
  const baseTools = ["list_dir", "read_file", "write_file", "exec", "ask_clarification"];

  // Mode-specific tools
  if (mode === "subagents") {
    baseTools.push("task", "write_todos");
  } else {
    baseTools.push("delegate_sub_tasks");
  }

  // Optional tools based on config
  if (config.tools.githubSearch.enabled) {
    baseTools.push("github_search");
  }
  if (config.tools.webSearch.enabled) {
    baseTools.push("web_search");
  }
  if (config.tools.webFetch.enabled) {
    baseTools.push("web_fetch");
  }

  return baseTools;
};

/**
 * Build the planner system prompt based on mode and config.
 * This is the main entry point for prompt generation.
 *
 * @param config Application configuration
 * @param options Optional parameters for prompt customization
 * @returns The complete system prompt for the planner
 */
export const buildPlannerSystemPrompt = (
  config: AppConfig,
  options?: PromptBuildOptions
): string => {
  const mode = options?.mode ?? "default";
  const userLanguage = options?.userMessage ? detectLanguage(options.userMessage) : "auto";

  const vars: PromptVariables = {
    mode,
    userLanguage,
    virtualRoot: config.sandbox.virtualRoot,
    allowedCommands: config.sandbox.allowedCommands.join(", "),
    enabledTools: buildEnabledToolsList(config, mode).join(", "),
    memoryContext: options?.memoryContext ?? "",
    maxSubTasks: config.subagent?.maxConcurrent ?? 3,
    currentDate: new Date().toISOString().split("T")[0],
    persistRequired: Boolean(options?.persistRequired),
    persistPathHint: options?.persistPathHint ?? ""
  };

  switch (mode) {
    case "thinking":
      return buildThinkingPlannerPrompt(vars);
    case "subagents":
      return buildSubagentsPlannerPrompt(vars);
    default:
      return buildDefaultPlannerPrompt(vars);
  }
};

/**
 * Build the final/synthesizer system prompt.
 * Used for generating the final response after tool execution.
 */
export const buildFinalSystemPrompt = (): string => {
  return buildSynthesizerPrompt();
};

// Re-export types and utilities for external use
export type { PromptVariables, PromptBuildOptions, ToolGuidance, DetectedLanguage } from "./types";
export { detectLanguage, getLanguageHint } from "./language-detector";
export { TOOL_CATALOG, getToolGuidance, getToolsByPriority } from "./tool-catalog";
export { applyTemplate, buildSection, joinSections } from "./template-engine";

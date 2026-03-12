/**
 * Prompt builders for the chat agent.
 *
 * This module re-exports from the new modular prompts system while maintaining
 * backward compatibility with the existing API.
 */

import type { AppConfig } from "../../config";
import type { ChatMode } from "../../../shared/ipc";
import {
  buildPlannerSystemPrompt as buildModularPlannerPrompt,
  buildFinalSystemPrompt as buildModularFinalPrompt,
  type PromptBuildOptions
} from "./prompts/index";

// Re-export types and utilities from the new prompts module
export type { PromptVariables, PromptBuildOptions, ToolGuidance, DetectedLanguage } from "./prompts/index";
export { detectLanguage, getLanguageHint } from "./prompts/index";
export { TOOL_CATALOG, getToolGuidance, getToolsByPriority } from "./prompts/index";

/**
 * Build the planner system prompt.
 *
 * @param config Application configuration
 * @param options Optional parameters for prompt customization
 * @returns The complete system prompt for the planner
 *
 * @example
 * // Basic usage (backward compatible)
 * const prompt = buildPlannerSystemPrompt(config);
 *
 * @example
 * // With mode and user message for language detection
 * const prompt = buildPlannerSystemPrompt(config, {
 *   mode: "subagents",
 *   userMessage: "搜索 GitHub 上的 AI 项目"
 * });
 */
export const buildPlannerSystemPrompt = (
  config: AppConfig,
  options?: PromptBuildOptions
): string => {
  return buildModularPlannerPrompt(config, options);
};

/**
 * Build the final/synthesizer system prompt.
 * Used for generating the final response after tool execution.
 */
export const buildFinalSystemPrompt = (): string => {
  return buildModularFinalPrompt();
};

/**
 * Helper type for the planner chat agent to pass mode and user message
 */
export type PlannerPromptContext = {
  mode?: ChatMode;
  userMessage?: string;
  memoryContext?: string;
};

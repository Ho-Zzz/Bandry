import type { ChatMode } from "../../../../shared/ipc";

/**
 * Detected language from user input
 */
export type DetectedLanguage = "zh" | "en" | "auto";

/**
 * Variables available for template injection
 */
export type PromptVariables = {
  /** Current chat mode */
  mode: ChatMode;
  /** Detected user language */
  userLanguage: DetectedLanguage;
  /** Sandbox virtual root path */
  virtualRoot: string;
  /** Allowed shell commands (comma-separated) */
  allowedCommands: string;
  /** Enabled tools list (comma-separated) */
  enabledTools: string;
  /** Memory context from previous conversations */
  memoryContext: string;
  /** Maximum sub-tasks per response (for subagents mode) */
  maxSubTasks: number;
  /** Current date in ISO format */
  currentDate: string;
};

/**
 * Tool guidance for the tool catalog
 */
export type ToolGuidance = {
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** When to use this tool */
  whenToUse: string[];
  /** When NOT to use this tool */
  whenNotToUse: string[];
  /** Priority for tool selection (higher = more specific) */
  priority: number;
};

/**
 * Clarification scenario types
 */
export type ClarificationScenario =
  | "missing_info"
  | "ambiguous_requirement"
  | "approach_choice"
  | "risk_confirmation"
  | "suggestion";

/**
 * Options for building prompts
 */
export type PromptBuildOptions = {
  /** Chat mode */
  mode?: ChatMode;
  /** User message for language detection */
  userMessage?: string;
  /** Memory context to inject */
  memoryContext?: string;
};

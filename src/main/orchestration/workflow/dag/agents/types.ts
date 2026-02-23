import type { LlmMessage } from "../../../../llm/runtime/types";
import type { AppConfig } from "../../../../config";

/**
 * Agent role types
 * Determines which tools an agent can access
 */
export type AgentRole = "lead" | "researcher" | "bash_operator" | "writer" | "web_researcher";

/**
 * Agent configuration
 */
export type AgentConfig = {
  role: AgentRole;
  workspacePath: string;
  allowedTools: string[];
  systemPrompt?: string;
};

/**
 * Agent execution result
 */
export type AgentResult = {
  success: boolean;
  output: string;
  error?: string;
  artifacts?: string[]; // Paths to generated files
};

/**
 * Sub-task definition for DAG
 */
export type SubTask = {
  subTaskId: string;
  agentRole: AgentRole;
  prompt: string;
  dependencies: string[]; // IDs of tasks that must complete first
  writePath?: string; // Where to write output (relative to workspace)
};

/**
 * DAG plan from Lead Agent
 */
export type DAGPlan = {
  tasks: SubTask[];
};

/**
 * Task node in dependency graph
 */
export type TaskNode = {
  task: SubTask;
  status: "pending" | "running" | "completed" | "failed";
  result?: AgentResult;
  startedAt?: number;
  completedAt?: number;
};

/**
 * Worker configuration for spawning sub-agents
 */
export type WorkerConfig = {
  workerId: string;
  agentRole: AgentRole;
  prompt: string;
  workspacePath: string;
  allowedTools: string[];
  writePath?: string;
  appConfig: AppConfig;
};

/**
 * Worker message types (IPC between main and worker)
 */
export type WorkerMessage =
  | { type: "progress"; message: string; progress: number }
  | { type: "completed"; result: AgentResult }
  | { type: "failed"; error: string };

/**
 * Tool definition
 */
export type ToolDefinition = {
  name: string;
  description: string;
  allowedRoles: AgentRole[];
  execute: (args: unknown, context: ToolExecutionContext) => Promise<unknown>;
};

/**
 * Tool execution context
 */
export type ToolExecutionContext = {
  workspacePath: string;
  agentRole: AgentRole;
};

/**
 * Agent execution input
 */
export type AgentExecutionInput = {
  prompt: string;
  messages?: LlmMessage[];
  workspacePath: string;
  writePath?: string;
};

/**
 * Task Types
 *
 * Type definitions for DAG-based task system.
 * Supports Lead Agent delegation model with Sub-Agent roles.
 */

/**
 * Task Status
 * Represents the current state of a DAG task or sub-task
 */
export type TaskStatus =
  | "PENDING"
  | "RUNNING"
  | "PAUSED_FOR_HITL"
  | "COMPLETED"
  | "FAILED";

/**
 * Sub-Agent Role
 * Defines the type of work a sub-agent can perform
 */
export type SubAgentRole =
  | "Researcher"
  | "WebResearcher"
  | "BashOperator"
  | "Writer";

/**
 * Sub-Task
 * Individual task within a DAG, executed by a specific sub-agent
 */
export interface SubTask {
  sub_task_id: string;
  agent_role: SubAgentRole;
  prompt: string;
  dependencies: string[];
  write_path: string;
  status: TaskStatus;
  output?: string;
  started_at?: number;
  completed_at?: number;
}

/**
 * Trace Entry
 * Log entry for task execution audit trail
 */
export interface TraceEntry {
  timestamp: number;
  type: "llm_request" | "tool_call" | "tool_result" | "state_change" | "error";
  data: Record<string, unknown>;
}

/**
 * DAG Task
 * Top-level task containing sub-tasks in a directed acyclic graph
 */
export interface DAGTask {
  task_id: string;
  prompt: string;
  status: TaskStatus;
  sub_tasks: SubTask[];
  workspace_path: string;
  input_files: string[];
  output_files: string[];
  created_at: number;
  completed_at?: number;
  trace_log: TraceEntry[];
}

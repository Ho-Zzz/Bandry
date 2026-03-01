export type PlannerDelegatedTask = {
  subTaskId: string;
  agentRole: "researcher" | "bash_operator" | "writer";
  prompt: string;
  dependencies: string[];
  writePath?: string;
};

/**
 * Sub-agent type for task tool (subagents mode)
 */
export type SubagentType = "general-purpose" | "researcher" | "bash" | "writer";

/**
 * Todo item for write_todos tool (subagents mode)
 */
export type TodoInput = {
  id: string;
  subject: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
};

/**
 * Base tool names available in all modes
 */
export type BasePlannerToolName =
  | "list_dir"
  | "read_file"
  | "write_file"
  | "exec"
  | "web_search"
  | "web_fetch"
  | "github_search"
  | "delegate_sub_tasks"
  | "ask_clarification"
  | "memory_search";

/**
 * Additional tool names for subagents mode
 */
export type SubagentsPlannerToolName = "write_todos" | "task";

/**
 * All possible tool names
 */
export type PlannerToolName = BasePlannerToolName | SubagentsPlannerToolName;

export type PlannerActionAnswer = {
  action: "answer";
  answer: string;
};

export type PlannerActionTool = {
  action: "tool";
  tool: PlannerToolName;
  input?: {
    // Base tool inputs
    path?: string;
    content?: string;
    overwrite?: boolean;
    command?: string;
    args?: string[];
    cwd?: string;
    timeoutMs?: number;
    query?: string;
    url?: string;
    question?: string;
    tasks?: PlannerDelegatedTask[];
    // write_todos tool inputs (subagents mode)
    todos?: TodoInput[];
    // task tool inputs (subagents mode)
    description?: string;
    prompt?: string;
    subagentType?: SubagentType;
    maxTurns?: number;
  };
  reason?: string;
};

export type PlannerAction = PlannerActionAnswer | PlannerActionTool;

export type ToolObservation = {
  tool: PlannerToolName;
  input: Record<string, unknown>;
  ok: boolean;
  output: string;
};

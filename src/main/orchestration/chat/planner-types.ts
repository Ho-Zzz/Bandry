export type PlannerDelegatedTask = {
  subTaskId: string;
  agentRole: "researcher" | "bash_operator" | "writer";
  prompt: string;
  dependencies: string[];
  writePath?: string;
};

export type PlannerToolName =
  | "list_dir"
  | "read_file"
  | "exec"
  | "web_search"
  | "web_fetch"
  | "delegate_sub_tasks"
  | "ask_clarification";

export type PlannerActionAnswer = {
  action: "answer";
  answer: string;
};

export type PlannerActionTool = {
  action: "tool";
  tool: PlannerToolName;
  input?: {
    path?: string;
    command?: string;
    args?: string[];
    cwd?: string;
    timeoutMs?: number;
    query?: string;
    url?: string;
    question?: string;
    tasks?: PlannerDelegatedTask[];
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

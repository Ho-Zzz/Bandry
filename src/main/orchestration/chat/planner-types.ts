export type PlannerToolName = "list_dir" | "read_file" | "exec" | "web_search" | "web_fetch";

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

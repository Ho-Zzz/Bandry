import type { AppConfig } from "../../../config";
import type { SandboxService } from "../../../sandbox";
import type { SubagentType, ToolObservation } from "../planner-types";
import type { ChatUpdateStage, SubagentProgressPayload } from "../../../../shared/ipc";

/**
 * task tool for sub-agents mode.
 *
 * Delegates a sub-task to a specialized agent.
 * Uses the DelegationEngine for DAG-based execution.
 */
export type TaskToolInput = {
  description: string;
  prompt: string;
  subagentType: SubagentType;
  maxTurns?: number;
};

export type TaskToolContext = {
  config: AppConfig;
  sandboxService: SandboxService;
  workspacePath: string;
  onUpdate?: (stage: ChatUpdateStage, message: string, payload?: { subagent?: SubagentProgressPayload }) => void;
  abortSignal?: AbortSignal;
};

/**
 * Get tools available for a sub-agent type
 */
const getToolsForSubagentType = (type: SubagentType): string[] => {
  switch (type) {
    case "general-purpose":
      // All tools except task and write_todos (no recursive delegation)
      return ["list_dir", "read_file", "exec", "web_search", "web_fetch", "ask_clarification"];
    case "researcher":
      // Read-only tools
      return ["list_dir", "read_file", "web_search", "web_fetch"];
    case "bash":
      // Command execution tools
      return ["exec", "read_file", "list_dir"];
    case "writer":
      // File writing tools
      return ["read_file", "list_dir"];
    default:
      return ["list_dir", "read_file"];
  }
};

/**
 * Execute task tool
 *
 * TODO: Integrate with DelegationEngine for actual sub-agent execution.
 * Currently returns a placeholder response.
 */
export const executeTaskTool = async (
  input: TaskToolInput,
  context: TaskToolContext
): Promise<ToolObservation> => {
  const { description, prompt, subagentType, maxTurns = 10 } = input;

  if (!description || !prompt || !subagentType) {
    return {
      tool: "task",
      input: input as unknown as Record<string, unknown>,
      ok: false,
      output: "Invalid input: description, prompt, and subagentType are required"
    };
  }

  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const availableTools = getToolsForSubagentType(subagentType);

  // Emit subagent progress
  context.onUpdate?.("subagent", `Starting ${subagentType} agent: ${description}`, {
    subagent: {
      taskId,
      agentType: subagentType === "general-purpose" ? "general-purpose" : subagentType,
      status: "running",
      progress: `Executing with tools: ${availableTools.join(", ")}`
    }
  });

  try {
    // TODO: Integrate with DelegationEngine
    // For now, return a placeholder indicating the task would be executed
    // The actual implementation will use:
    // - DelegationEngine.execute() for DAG scheduling
    // - WorkerPool for parallel execution
    // - SubAgentWorker for individual task execution

    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Check for abort
    if (context.abortSignal?.aborted) {
      throw new Error("Task cancelled");
    }

    // Emit completion
    context.onUpdate?.("subagent", `Completed ${subagentType} agent: ${description}`, {
      subagent: {
        taskId,
        agentType: subagentType === "general-purpose" ? "general-purpose" : subagentType,
        status: "completed"
      }
    });

    return {
      tool: "task",
      input: {
        description,
        subagentType,
        maxTurns
      },
      ok: true,
      output: `[Placeholder] Task "${description}" would be executed by ${subagentType} agent with prompt: "${prompt.slice(0, 100)}...". Available tools: ${availableTools.join(", ")}. Max turns: ${maxTurns}.`
    };
  } catch (error) {
    // Emit failure
    context.onUpdate?.("subagent", `Failed ${subagentType} agent: ${description}`, {
      subagent: {
        taskId,
        agentType: subagentType === "general-purpose" ? "general-purpose" : subagentType,
        status: "failed"
      }
    });

    return {
      tool: "task",
      input: { description, subagentType },
      ok: false,
      output: error instanceof Error ? error.message : String(error)
    };
  }
};

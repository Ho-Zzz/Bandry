import type { SandboxExecInput, ChatUpdateStage, SubagentProgressPayload } from "../../../shared/ipc";
import type { AppConfig } from "../../config";
import type { MemoryProvider } from "../../memory/contracts/types";
import type { SandboxService } from "../../sandbox";
import type { DAGPlan, AgentResult } from "../workflow/dag/agents";
import { DelegationEngine } from "../workflow/dag/delegation-engine";
import { validateDelegationTasks } from "./delegation-schema";
import { runWebFetch, runWebSearch, runGitHubSearch } from "./internal-web-tools";
import { formatExec, formatListDir, formatReadFile } from "./observation-formatters";
import type { PlannerActionTool, ToolObservation, TodoInput, SubagentType } from "./planner-types";
import { normalizeSpaces } from "./text-utils";
import { executeWriteTodos, type WriteTodosContext } from "./tools/write-todos-tool";
import { executeTaskTool, type TaskToolContext } from "./tools/task-tool";
import { executeMemorySearch } from "./tools/memory-tool";
import type { TodoItem } from "./middleware/types";

type ExecutePlannerToolOptions = {
  action: PlannerActionTool;
  config: AppConfig;
  sandboxService: SandboxService;
  workspacePath?: string;
  onDelegationUpdate?: (message: string) => void;
  onSubagentUpdate?: (stage: ChatUpdateStage, message: string, payload?: { subagent?: SubagentProgressPayload }) => void;
  abortSignal?: AbortSignal;
  todos?: TodoItem[];
  memoryProvider?: MemoryProvider;
  sessionId?: string;
};

export const executePlannerTool = async ({
  action,
  config,
  sandboxService,
  workspacePath,
  onDelegationUpdate,
  onSubagentUpdate,
  abortSignal,
  todos = [],
  memoryProvider,
  sessionId
}: ExecutePlannerToolOptions): Promise<ToolObservation & { updatedTodos?: TodoItem[] }> => {
  const fallbackPath = config.sandbox.virtualRoot;

  try {
    if (action.tool === "list_dir") {
      const targetPath = action.input?.path?.trim() || fallbackPath;
      const result = await sandboxService.listDir({ path: targetPath });
      return {
        tool: "list_dir",
        input: { path: targetPath },
        ok: true,
        output: formatListDir(result)
      };
    }

    if (action.tool === "read_file") {
      const targetPath = action.input?.path?.trim();
      if (!targetPath) {
        return {
          tool: "read_file",
          input: {},
          ok: false,
          output: "Missing required field: input.path"
        };
      }

      const result = await sandboxService.readFile({ path: targetPath });
      return {
        tool: "read_file",
        input: { path: targetPath },
        ok: true,
        output: formatReadFile(result)
      };
    }

    if (action.tool === "write_file") {
      const targetPath = action.input?.path?.trim();
      const content = action.input?.content;
      if (!targetPath) {
        return {
          tool: "write_file",
          input: {},
          ok: false,
          output: "Missing required field: input.path"
        };
      }
      if (content === undefined || content === null) {
        return {
          tool: "write_file",
          input: { path: targetPath },
          ok: false,
          output: "Missing required field: input.content"
        };
      }

      const result = await sandboxService.writeFile({
        path: targetPath,
        content: String(content),
        createDirs: true,
        overwrite: true
      });
      return {
        tool: "write_file",
        input: { path: targetPath },
        ok: true,
        output: `File written: ${result.path} (${result.bytesWritten} bytes)`
      };
    }

    if (action.tool === "web_search") {
      const query = action.input?.query?.trim();
      if (!query) {
        return {
          tool: "web_search",
          input: action.input ?? {},
          ok: false,
          output: "Missing required field: input.query"
        };
      }

      const result = await runWebSearch(config, query);
      return {
        tool: "web_search",
        input: { query },
        ok: true,
        output: result
      };
    }

    if (action.tool === "web_fetch") {
      const url = action.input?.url?.trim();
      if (!url) {
        return {
          tool: "web_fetch",
          input: action.input ?? {},
          ok: false,
          output: "Missing required field: input.url"
        };
      }

      const result = await runWebFetch(config, url);
      return {
        tool: "web_fetch",
        input: { url },
        ok: true,
        output: result
      };
    }

    if (action.tool === "github_search") {
      const query = action.input?.query?.trim();
      if (!query) {
        return {
          tool: "github_search",
          input: action.input ?? {},
          ok: false,
          output: "Missing required field: input.query"
        };
      }

      const result = await runGitHubSearch(config, query, "repositories");
      return {
        tool: "github_search",
        input: { query },
        ok: true,
        output: result
      };
    }

    if (action.tool === "memory_search") {
      return executeMemorySearch(
        { query: action.input?.query },
        { memoryProvider, sessionId: sessionId ?? "default" }
      );
    }

    if (action.tool === "ask_clarification") {
      const question = action.input?.question?.trim();
      return {
        tool: "ask_clarification",
        input: action.input ?? {},
        ok: false,
        output: question ? `Clarification required: ${question}` : "Clarification required"
      };
    }

    if (action.tool === "delegate_sub_tasks") {
      const tasks = validateDelegationTasks(action.input?.tasks ?? []);
      const plan: DAGPlan = {
        tasks: tasks.map((task) => ({
          subTaskId: task.subTaskId,
          agentRole: task.agentRole,
          prompt: task.prompt,
          dependencies: task.dependencies,
          writePath: task.writePath
        }))
      };

      const engine = new DelegationEngine({
        maxWorkers: 3
      });
      onDelegationUpdate?.(`委派 ${plan.tasks.length} 个子任务，开始执行 DAG...`);

      const results = await engine.execute({
        plan,
        workspacePath: workspacePath || config.paths.workspacesDir,
        appConfig: config,
        abortSignal,
        onEvent: (event) => {
          if (event.type === "task_started") {
            onDelegationUpdate?.(`子任务启动：${event.taskId}`);
            return;
          }
          if (event.type === "task_completed") {
            onDelegationUpdate?.(`子任务完成：${event.taskId}`);
            return;
          }
          if (event.type === "task_progress") {
            onDelegationUpdate?.(
              `子任务进度：${event.taskId}${event.progress !== undefined ? ` (${Math.round(event.progress * 100)}%)` : ""} ${event.message}`
            );
            return;
          }
          if (event.type === "task_failed") {
            onDelegationUpdate?.(`子任务失败：${event.taskId} -> ${event.error}`);
            return;
          }
          onDelegationUpdate?.("委派任务已中止");
        }
      });

      const entries = Array.from(results.entries());
      const successCount = entries.filter(([, result]) => result.success).length;
      const failed = entries.filter(([, result]) => !result.success);
      const failedText = failed
        .map(([taskId, result]) => `${taskId}: ${result.error ?? "unknown error"}`)
        .join("; ");
      const virtualRoot = config.sandbox.virtualRoot.replace(/\/+$/, "");
      const artifacts = entries
        .flatMap(([, result]) => result.artifacts ?? [])
        .filter((value, index, list) => list.indexOf(value) === index)
        .map((artifact) => {
          if (artifact.startsWith(`${virtualRoot}/`)) return artifact;
          const relative = artifact.startsWith("/") ? artifact.slice(1) : artifact;
          return `${virtualRoot}/${relative}`;
        });

      const renderResult = (taskId: string, result: AgentResult): string => {
        const suffix = result.error ? ` | error=${result.error}` : "";
        return `${taskId}: ${result.success ? "success" : "failed"}${suffix}`;
      };

      return {
        tool: "delegate_sub_tasks",
        input: { tasks: plan.tasks },
        ok: failed.length === 0,
        output: [
          `Delegation finished: ${successCount}/${entries.length} succeeded.`,
          ...entries.map(([taskId, result]) => renderResult(taskId, result)),
          ...(artifacts.length > 0 ? [`Artifacts: ${artifacts.join(", ")}`] : []),
          ...(failedText ? [`Failures: ${failedText}`] : [])
        ].join("\n")
      };
    }

    // write_todos tool (subagents mode)
    if (action.tool === "write_todos") {
      const todosInput = action.input?.todos as TodoInput[] | undefined;
      if (!todosInput) {
        return {
          tool: "write_todos",
          input: action.input ?? {},
          ok: false,
          output: "Missing required field: input.todos"
        };
      }

      const context: WriteTodosContext = { todos };
      const result = executeWriteTodos({ todos: todosInput }, context);
      return {
        ...result.observation,
        updatedTodos: result.updatedTodos
      };
    }

    // task tool (subagents mode)
    if (action.tool === "task") {
      const description = action.input?.description?.trim();
      const prompt = action.input?.prompt?.trim();
      const subagentType = action.input?.subagentType as SubagentType | undefined;

      if (!description || !prompt || !subagentType) {
        return {
          tool: "task",
          input: action.input ?? {},
          ok: false,
          output: "Missing required fields: description, prompt, and subagentType"
        };
      }

      const taskContext: TaskToolContext = {
        config,
        sandboxService,
        workspacePath: workspacePath || config.paths.workspacesDir,
        onUpdate: onSubagentUpdate,
        abortSignal
      };

      return executeTaskTool(
        {
          description,
          prompt,
          subagentType,
          maxTurns: action.input?.maxTurns
        },
        taskContext
      );
    }

    const command = action.input?.command?.trim() || "ls";
    const execInput: SandboxExecInput = {
      command,
      args: action.input?.args,
      cwd: action.input?.cwd,
      timeoutMs: action.input?.timeoutMs
    };
    const result = await sandboxService.exec(execInput);

    return {
      tool: "exec",
      input: execInput,
      ok: result.exitCode === 0,
      output: formatExec(result)
    };
  } catch (error) {
    return {
      tool: action.tool,
      input: action.input ?? {},
      ok: false,
      output: normalizeSpaces(error instanceof Error ? error.message : "Tool execution failed")
    };
  }
};

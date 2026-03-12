import type { SandboxExecInput, ChatUpdateStage, SubagentProgressPayload } from "../../../shared/ipc";
import type { AppConfig } from "../../config";
import type { MemoryProvider } from "../../memory/contracts/types";
import type { SandboxService } from "../../sandbox";
import { SandboxViolationError } from "../../sandbox/errors";
import type { DAGPlan, AgentResult } from "../workflow/dag/agents";
import { DelegationEngine } from "../workflow/dag/delegation-engine";
import { validateDelegationTasks } from "./delegation-schema";
import { runWebFetch, runWebSearch, runGitHubSearch } from "./internal-web-tools";
import {
  resolvePersistWritePath,
  validatePersistContent
} from "./persist-policy";
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
  const virtualRoot = config.sandbox.virtualRoot.replace(/\/+$/, "");
  const normalizeArtifactPath = (artifactPath: string): string => {
    if (artifactPath.startsWith(`${virtualRoot}/`)) {
      return artifactPath;
    }
    const relative = artifactPath.startsWith("/") ? artifactPath.slice(1) : artifactPath;
    return `${virtualRoot}/${relative}`;
  };
  const isSupportedArtifactPath = (artifactPath: string): boolean => {
    const normalized = artifactPath.trim();
    if (!normalized) {
      return false;
    }

    if (normalized.startsWith(`${virtualRoot}/output/`)) {
      return true;
    }

    const relative = normalized.startsWith("/") ? normalized.slice(1) : normalized;
    return relative.startsWith("output/");
  };

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
      const content = action.input?.content;
      if (typeof content !== "string") {
        return {
          tool: "write_file",
          input: action.input ?? {},
          ok: false,
          output: "Missing required field: input.content"
        };
      }

      const contentError = validatePersistContent(content);
      if (contentError) {
        return {
          tool: "write_file",
          input: action.input ?? {},
          ok: false,
          output: `CONTENT_LIMIT: ${contentError}`
        };
      }

      const writePathResult = resolvePersistWritePath({
        requestedPath: action.input?.path,
        defaultPath: "output/document.md",
        virtualRoot: config.sandbox.virtualRoot
      });
      if (!writePathResult.ok) {
        return {
          tool: "write_file",
          input: action.input ?? {},
          ok: false,
          output: `${writePathResult.code}: ${writePathResult.message}`
        };
      }

      const result = await sandboxService.writeFile({
        path: writePathResult.path,
        content,
        createDirs: true,
        overwrite: false
      });
      return {
        tool: "write_file",
        input: { path: writePathResult.path, overwrite: false },
        ok: true,
        output: `Wrote file successfully: path=${result.path}, bytes=${result.bytesWritten}`,
        artifacts: [normalizeArtifactPath(result.path)]
      };
    }

    if (action.tool === "present_files") {
      const filepaths = action.input?.filepaths;
      if (!Array.isArray(filepaths) || filepaths.length === 0) {
        return {
          tool: "present_files",
          input: action.input ?? {},
          ok: false,
          output: "Missing required field: input.filepaths"
        };
      }

      const invalidPath = filepaths.find((value) => typeof value !== "string" || !isSupportedArtifactPath(value));
      if (invalidPath) {
        return {
          tool: "present_files",
          input: action.input ?? {},
          ok: false,
          output: `PATH_NOT_ALLOWED: Only files under ${virtualRoot}/output are allowed for present_files. Invalid path: ${String(invalidPath)}`
        };
      }

      const artifacts = filepaths
        .map((value) => normalizeArtifactPath(value))
        .filter((value, index, list) => list.indexOf(value) === index);
      return {
        tool: "present_files",
        input: { filepaths: artifacts },
        ok: true,
        output: artifacts.length > 0 ? `Presented files: ${artifacts.join(", ")}` : "No files presented",
        artifacts
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
      const artifacts = entries
        .flatMap(([, result]) => result.artifacts ?? [])
        .filter((value, index, list) => list.indexOf(value) === index)
        .map((artifact) => normalizeArtifactPath(artifact));

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
          ...(failedText ? [`Failures: ${failedText}`] : [])
        ].join("\n"),
        artifacts
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
    if (error instanceof SandboxViolationError) {
      return {
        tool: action.tool,
        input: action.input ?? {},
        ok: false,
        output: `${error.code}: ${normalizeSpaces(error.message)}`
      };
    }

    return {
      tool: action.tool,
      input: action.input ?? {},
      ok: false,
      output: normalizeSpaces(error instanceof Error ? error.message : "Tool execution failed")
    };
  }
};

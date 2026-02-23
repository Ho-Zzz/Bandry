import type { SandboxExecInput } from "../../../shared/ipc";
import type { AppConfig } from "../../config";
import type { SandboxService } from "../../sandbox";
import type { DAGPlan, AgentResult } from "../workflow/dag/agents";
import { DelegationEngine } from "../workflow/dag/delegation-engine";
import { validateDelegationTasks } from "./delegation-schema";
import { runWebFetch, runWebSearch } from "./internal-web-tools";
import { formatExec, formatListDir, formatReadFile } from "./observation-formatters";
import type { PlannerActionTool, ToolObservation } from "./planner-types";
import { normalizeSpaces } from "./text-utils";

type ExecutePlannerToolOptions = {
  action: PlannerActionTool;
  config: AppConfig;
  sandboxService: SandboxService;
  workspacePath?: string;
  onDelegationUpdate?: (message: string) => void;
  abortSignal?: AbortSignal;
};

export const executePlannerTool = async ({
  action,
  config,
  sandboxService,
  workspacePath,
  onDelegationUpdate,
  abortSignal
}: ExecutePlannerToolOptions): Promise<ToolObservation> => {
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
        .filter((value, index, list) => list.indexOf(value) === index);

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

import type { SandboxExecInput } from "../../../shared/ipc";
import type { AppConfig } from "../../config";
import type { SandboxService } from "../../sandbox";
import { runWebFetch, runWebSearch } from "./internal-web-tools";
import { formatExec, formatListDir, formatReadFile } from "./observation-formatters";
import type { PlannerActionTool, ToolObservation } from "./planner-types";
import { normalizeSpaces } from "./text-utils";

type ExecutePlannerToolOptions = {
  action: PlannerActionTool;
  config: AppConfig;
  sandboxService: SandboxService;
};

export const executePlannerTool = async ({
  action,
  config,
  sandboxService
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

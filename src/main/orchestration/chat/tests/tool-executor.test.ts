import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createDefaultConfig } from "../../../config/default-config";
import { SandboxViolationError } from "../../../sandbox/errors";
import { executePlannerTool } from "../tool-executor";
import type { PlannerActionTool } from "../planner-types";

const createConfig = () => {
  const workspaceDir = path.resolve("/tmp/bandry-tool-executor-tests");
  return createDefaultConfig({
    paths: {
      projectRoot: workspaceDir,
      bandryHome: workspaceDir,
      configDir: path.join(workspaceDir, "config"),
      logsDir: path.join(workspaceDir, "logs"),
      workspaceDir,
      workspacesDir: workspaceDir,
      resourcesDir: path.join(workspaceDir, "resources"),
      pluginsDir: path.join(workspaceDir, "plugins"),
      traceDir: path.join(workspaceDir, "traces"),
      projectConfigPath: path.join(workspaceDir, "config.json"),
      userConfigPath: path.join(workspaceDir, "user-config.json"),
      auditLogPath: path.join(workspaceDir, "model-audit.log"),
      sandboxAuditLogPath: path.join(workspaceDir, "sandbox-audit.log"),
      databasePath: path.join(workspaceDir, "bandry.db"),
      dotenvPath: path.join(workspaceDir, ".env")
    },
    runtime: {
      inheritedEnv: {}
    }
  });
};

describe("executePlannerTool write_file", () => {
  it("writes file under /output and returns path/bytes", async () => {
    const config = createConfig();
    const action: PlannerActionTool = {
      action: "tool",
      tool: "write_file",
      input: {
        path: "output/report.md",
        content: "# report"
      }
    };
    const sandboxService = {
      listDir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(async (payload: { path: string; content: string }) => ({
        path: payload.path,
        bytesWritten: Buffer.byteLength(payload.content, "utf8")
      })),
      exec: vi.fn()
    };

    const observation = await executePlannerTool({
      action,
      config,
      sandboxService: sandboxService as never
    });

    expect(observation.ok).toBe(true);
    expect(observation.output).toContain("path=/mnt/workspace/output/report.md");
    expect(observation.output).toContain("bytes=");
    expect(sandboxService.writeFile).toHaveBeenCalledWith({
      path: "/mnt/workspace/output/report.md",
      content: "# report",
      createDirs: true,
      overwrite: false
    });
  });

  it("returns file exists error when target already exists", async () => {
    const config = createConfig();
    const action: PlannerActionTool = {
      action: "tool",
      tool: "write_file",
      input: {
        path: "output/report.md",
        content: "# report"
      }
    };
    const sandboxService = {
      listDir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(async () => {
        throw new SandboxViolationError("FILE_EXISTS", "Target file already exists");
      }),
      exec: vi.fn()
    };

    const observation = await executePlannerTool({
      action,
      config,
      sandboxService: sandboxService as never
    });

    expect(observation.ok).toBe(false);
    expect(observation.output).toContain("FILE_EXISTS");
  });

  it("rejects paths outside /output", async () => {
    const config = createConfig();
    const action: PlannerActionTool = {
      action: "tool",
      tool: "write_file",
      input: {
        path: "/mnt/workspace/README.md",
        content: "hello"
      }
    };
    const sandboxService = {
      listDir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exec: vi.fn()
    };

    const observation = await executePlannerTool({
      action,
      config,
      sandboxService: sandboxService as never
    });

    expect(observation.ok).toBe(false);
    expect(observation.output).toContain("PATH_NOT_ALLOWED");
    expect(sandboxService.writeFile).not.toHaveBeenCalled();
  });
});

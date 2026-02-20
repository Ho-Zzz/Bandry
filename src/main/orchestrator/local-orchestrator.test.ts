import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createDefaultConfig } from "../config/default-config";
import { LocalOrchestrator } from "./local-orchestrator";

const createTestConfig = () => {
  const workspaceDir = path.resolve("/tmp/bandry-orchestrator-workspace");
  return createDefaultConfig({
    workspaceDir,
    projectConfigPath: path.join(workspaceDir, "config.json"),
    userConfigPath: path.join(workspaceDir, "user-config.json"),
    auditLogPath: path.join(workspaceDir, "model-audit.log"),
    sandboxAuditLogPath: path.join(workspaceDir, "sandbox-audit.log"),
    databasePath: path.join(workspaceDir, "bandry.db"),
    traceDir: path.join(workspaceDir, "traces"),
    resourcesDir: path.join(workspaceDir, "resources")
  });
};

describe("LocalOrchestrator", () => {
  it("runs sandbox tools and returns local summary when model is disabled", async () => {
    const config = createTestConfig();
    const sandbox = {
      listDir: vi.fn(async () => ({
        path: "/mnt/workspace",
        entries: [{ name: "README.md", virtualPath: "/mnt/workspace/README.md", type: "file" as const }]
      })),
      readFile: vi.fn(async () => ({
        path: "/mnt/workspace/README.md",
        content: "hello world"
      })),
      exec: vi.fn(),
      writeFile: vi.fn()
    };
    const models = {
      isProviderConfigured: vi.fn(() => false),
      generateText: vi.fn()
    };

    const orchestrator = new LocalOrchestrator(config, sandbox as never, models as never);
    const progress: string[] = [];

    const result = await orchestrator.runTask(
      {
        taskId: "task_1",
        prompt: "Please read /mnt/workspace/README.md and summarize",
        files: [],
        useModel: false
      },
      (_status, _progress, message) => {
        progress.push(message);
      }
    );

    expect(sandbox.listDir).toHaveBeenCalled();
    expect(sandbox.readFile).toHaveBeenCalledWith({ path: "/mnt/workspace/README.md" });
    expect(models.generateText).not.toHaveBeenCalled();
    expect(result.usedModel).toBe(false);
    expect(result.outputText).toContain("read_file /mnt/workspace/README.md");
    expect(progress.some((item) => item.includes("Planner generated"))).toBe(true);
  });

  it("uses model synthesis when provider is configured", async () => {
    const config = createTestConfig();
    const sandbox = {
      listDir: vi.fn(async () => ({
        path: "/mnt/workspace",
        entries: []
      })),
      readFile: vi.fn(),
      exec: vi.fn(),
      writeFile: vi.fn()
    };
    const models = {
      isProviderConfigured: vi.fn(() => true),
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4.1-mini",
        text: "Model summary",
        latencyMs: 120
      }))
    };

    const orchestrator = new LocalOrchestrator(config, sandbox as never, models as never);
    const result = await orchestrator.runTask(
      {
        taskId: "task_2",
        prompt: "List files in workspace",
        files: [],
        useModel: true
      },
      () => {}
    );

    expect(models.generateText).toHaveBeenCalledTimes(1);
    expect(result.usedModel).toBe(true);
    expect(result.outputText).toBe("Model summary");
  });
});

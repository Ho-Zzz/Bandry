import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ChatSendInput } from "../../shared/ipc";
import { createDefaultConfig } from "../config/default-config";
import { DeepSeekToolChatAgent } from "./deepseek-tool-chat-agent";

const createConfig = () => {
  const workspaceDir = path.resolve("/tmp/bandry-chat-workspace");
  const config = createDefaultConfig({
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
  config.providers.openai.apiKey = "test-openai-key";
  config.providers.deepseek.apiKey = "test-deepseek-key";
  config.providers.volcengine.apiKey = "test-volcengine-key";
  return config;
};

describe("DeepSeekToolChatAgent", () => {
  it("uses tool step then returns final answer", async () => {
    const config = createConfig();

    const modelsFactory = {
      isProviderConfigured: vi.fn(() => true),
      generateText: vi
        .fn()
        .mockResolvedValueOnce({
          provider: "deepseek",
          model: "deepseek-chat",
          text: '{"action":"tool","tool":"list_dir","input":{"path":"/mnt/workspace"}}',
          latencyMs: 100
        })
        .mockResolvedValueOnce({
          provider: "deepseek",
          model: "deepseek-chat",
          text: '{"action":"answer","answer":"I checked the workspace and found README.md"}',
          latencyMs: 120
        })
    };

    const sandboxService = {
      listDir: vi.fn(async () => ({
        path: "/mnt/workspace",
        entries: [{ name: "README.md", virtualPath: "/mnt/workspace/README.md", type: "file" as const }]
      })),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exec: vi.fn()
    };

    const agent = new DeepSeekToolChatAgent(config, modelsFactory as never, sandboxService as never);
    const updates: Array<{ stage: string; message: string }> = [];

    const input: ChatSendInput = {
      message: "请看看工作区里有什么文件",
      history: []
    };

    const result = await agent.send(input, (stage, message) => {
      updates.push({ stage, message });
    });

    expect(result.reply).toContain("README.md");
    expect(result.provider).toBe("deepseek");
    expect(modelsFactory.generateText).toHaveBeenCalledTimes(2);
    expect(sandboxService.listDir).toHaveBeenCalledWith({ path: "/mnt/workspace" });
    expect(updates.some((item) => item.stage === "tool")).toBe(true);
  });

  it("falls back to direct model text when planner output is not json", async () => {
    const config = createConfig();
    const modelsFactory = {
      isProviderConfigured: vi.fn(() => true),
      generateText: vi.fn(async () => ({
        provider: "deepseek",
        model: "deepseek-chat",
        text: "Direct plain answer",
        latencyMs: 90
      }))
    };

    const sandboxService = {
      listDir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exec: vi.fn()
    };

    const agent = new DeepSeekToolChatAgent(config, modelsFactory as never, sandboxService as never);

    const result = await agent.send({
      message: "你好",
      history: []
    });

    expect(result.reply).toBe("Direct plain answer");
    expect(modelsFactory.generateText).toHaveBeenCalledTimes(1);
  });
});

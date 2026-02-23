import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { ChatSendInput } from "../../shared/ipc";
import { createDefaultConfig } from "../config/default-config";
import { ToolPlanningChatAgent } from "./tool-planning-chat-agent";

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
  config.providers.openai.apiKey = "sk-openai-valid-key-1234567890";
  config.providers.deepseek.apiKey = "sk-deepseek-valid-key-1234567890";
  config.providers.volcengine.apiKey = "test-volcengine-key";
  return config;
};

describe("ToolPlanningChatAgent", () => {
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
        }),
      generateTextStream: vi.fn(async (_input, onDelta: (delta: string) => void) => {
        onDelta("I checked ");
        onDelta("the workspace and found README.md");
        return {
          provider: "deepseek",
          model: "deepseek-chat",
          text: "I checked the workspace and found README.md",
          latencyMs: 110
        };
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

    const agent = new ToolPlanningChatAgent(config, modelsFactory as never, sandboxService as never);
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
      })),
      generateTextStream: vi.fn(async () => ({
        provider: "deepseek",
        model: "deepseek-chat",
        text: "Direct plain answer",
        latencyMs: 100
      }))
    };

    const sandboxService = {
      listDir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exec: vi.fn()
    };

    const agent = new ToolPlanningChatAgent(config, modelsFactory as never, sandboxService as never);

    const result = await agent.send({
      message: "你好",
      history: []
    });

    expect(result.reply).toBe("Direct plain answer");
    expect(modelsFactory.generateText).toHaveBeenCalledTimes(1);
  });

  it("stops planning after first failing tool to avoid repeated invalid path calls", async () => {
    const config = createConfig();
    const modelsFactory = {
      isProviderConfigured: vi.fn(() => true),
      generateText: vi.fn(async () => ({
        provider: "deepseek",
        model: "deepseek-chat",
        text: '{"action":"tool","tool":"list_dir","input":{"path":"/mnt/workspace/missing"}}',
        latencyMs: 90
      })),
      generateTextStream: vi.fn(async () => ({
        provider: "deepseek",
        model: "deepseek-chat",
        text: "I cannot access the requested path.",
        latencyMs: 100
      }))
    };

    const sandboxService = {
      listDir: vi.fn(async () => {
        throw new Error("Path does not exist");
      }),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exec: vi.fn()
    };

    const agent = new ToolPlanningChatAgent(config, modelsFactory as never, sandboxService as never);

    const result = await agent.send({
      message: "帮我看看项目目录",
      history: []
    });

    expect(result.reply).toContain("cannot access");
    expect(modelsFactory.generateText).toHaveBeenCalledTimes(1);
    expect(sandboxService.listDir).toHaveBeenCalledTimes(1);
  });

  it("can execute web_search when planner selects it", async () => {
    const config = createConfig();
    config.tools.webSearch.enabled = true;
    config.tools.webSearch.apiKey = "tvly-test-key";

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          results: [
            {
              title: "Pop Mart latest update",
              url: "https://example.com/popmart",
              content: "Sample market snapshot"
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const modelsFactory = {
      isProviderConfigured: vi.fn(() => true),
      generateText: vi
        .fn()
        .mockResolvedValueOnce({
          provider: "deepseek",
          model: "deepseek-chat",
          text: '{"action":"tool","tool":"web_search","input":{"query":"泡泡玛特 港股 最新 数据"}}',
          latencyMs: 30
        })
        .mockResolvedValueOnce({
          provider: "deepseek",
          model: "deepseek-chat",
          text: '{"action":"answer","answer":"根据检索结果，泡泡玛特近期表现稳健。"}',
          latencyMs: 35
        }),
      generateTextStream: vi.fn(async () => ({
        provider: "deepseek",
        model: "deepseek-chat",
        text: "根据检索结果，泡泡玛特近期表现稳健。",
        latencyMs: 80
      }))
    };

    const sandboxService = {
      listDir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exec: vi.fn()
    };

    const agent = new ToolPlanningChatAgent(config, modelsFactory as never, sandboxService as never);
    const updates: Array<{ stage: string; message: string }> = [];

    try {
      const result = await agent.send(
        {
          message: "请你分析一下港股泡泡玛特的数据表现情况如何",
          history: []
        },
        (stage, detail) => {
          updates.push({ stage, message: detail });
        }
      );

      expect(result.reply).toContain("泡泡玛特");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(modelsFactory.generateText).toHaveBeenCalledTimes(2);
      expect(updates.some((item) => item.message.includes("执行工具：web_search"))).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not fallback when lead route profile is unusable", async () => {
    const config = createConfig();
    config.providers.openai.apiKey = "123123123";

    const modelsFactory = {
      isProviderConfigured: vi.fn(() => true),
      generateText: vi.fn(),
      generateTextStream: vi.fn()
    };

    const sandboxService = {
      listDir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exec: vi.fn()
    };

    const agent = new ToolPlanningChatAgent(config, modelsFactory as never, sandboxService as never);

    await expect(
      agent.send({
        message: "hello",
        history: []
      })
    ).rejects.toThrow(
      'LeadAgent 路由配置错误: [lead.planner] provider "openai" for profile "profile_openai_default" has missing or invalid API key.'
    );
  });

  it("reports lead.synthesizer model failures with binding details", async () => {
    const config = createConfig();
    config.routing.assignments["lead.planner"] = "profile_deepseek_default";
    config.routing.assignments["lead.synthesizer"] = "profile_deepseek_default";

    const modelsFactory = {
      isProviderConfigured: vi.fn(() => true),
      generateText: vi.fn(async () => ({
        provider: "deepseek",
        model: "deepseek-chat",
        text: '{"action":"answer","answer":"draft"}',
        latencyMs: 30
      })),
      generateTextStream: vi.fn(async () => {
        throw new Error("provider timeout");
      })
    };

    const sandboxService = {
      listDir: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      exec: vi.fn()
    };

    const agent = new ToolPlanningChatAgent(config, modelsFactory as never, sandboxService as never);

    await expect(
      agent.send({
        message: "请总结一下",
        history: []
      })
    ).rejects.toThrow(
      "[lead.synthesizer profile=profile_deepseek_default model=deepseek/deepseek-chat] model call failed: provider timeout"
    );
  });
});

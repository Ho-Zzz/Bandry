import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createDefaultConfig } from "../../../../config/default-config";
import { TitleMiddleware } from "../title";
import type { MiddlewareContext } from "../types";

const createConfig = () => {
  const workspaceDir = path.resolve("/tmp/bandry-title-tests");
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
      skillsDir: path.join(workspaceDir, "skills"),
      soulDir: path.join(workspaceDir, "soul"),
      projectConfigPath: path.join(workspaceDir, "config.json"),
      userConfigPath: path.join(workspaceDir, "user-config.json"),
      auditLogPath: path.join(workspaceDir, "model-audit.log"),
      sandboxAuditLogPath: path.join(workspaceDir, "sandbox-audit.log"),
      databasePath: path.join(workspaceDir, "bandry.db"),
    },
    runtime: {
      inheritedEnv: {}
    }
  });
  config.providers.openai.apiKey = "sk-openai-valid-key-1234567890";
  config.modelProfiles = [
    {
      id: "profile_openai_default",
      name: "OpenAI Default",
      provider: "openai",
      model: "gpt-4.1-mini",
      enabled: true
    }
  ];
  config.routing.assignments["chat.default"] = "profile_openai_default";
  config.routing.assignments["lead.planner"] = "profile_openai_default";
  config.routing.assignments["lead.synthesizer"] = "profile_openai_default";
  config.routing.assignments["memory.fact_extractor"] = "profile_openai_default";
  return config;
};

describe("TitleMiddleware", () => {
  it("generates and persists title when conversation has no title", async () => {
    const middleware = new TitleMiddleware();
    const config = createConfig();

    const modelsFactory = {
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4.1-mini",
        text: "Bandry Delegation Plan",
        latencyMs: 10
      }))
    };

    const conversationStore = {
      getConversation: vi.fn(() => ({ id: "conv-1", title: undefined })),
      updateConversation: vi.fn()
    };
    const onUpdate = vi.fn();

    const ctx: MiddlewareContext = {
      sessionId: "s1",
      taskId: "t1",
      conversationId: "conv-1",
      workspacePath: "/tmp/workspace",
      messages: [{ role: "user", content: "帮我整理迁移方案" }],
      tools: [],
      metadata: {},
      state: "after_agent",
      finalResponse: "这里是完整方案",
      runtime: {
        config,
        modelsFactory: modelsFactory as never,
        sandboxService: {} as never,
        conversationStore: conversationStore as never,
        onUpdate
      }
    };

    const result = await middleware.afterAgent!(ctx);

    // Title generation is now async, so we need to wait a bit
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(modelsFactory.generateText).not.toHaveBeenCalled();
    expect(conversationStore.updateConversation).toHaveBeenCalledWith("conv-1", {
      title: "整理迁移方案"
    });
    expect(onUpdate).not.toHaveBeenCalled();
    // Metadata is no longer set since title generation is async
    expect(result.metadata.titleGenerated).toBeUndefined();
  });

  it("uses fallback when model returns empty content", async () => {
    const middleware = new TitleMiddleware();
    const config = createConfig();

    const modelsFactory = {
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4.1-mini",
        text: "",
        latencyMs: 10
      }))
    };

    const conversationStore = {
      getConversation: vi.fn(() => ({ id: "conv-2", title: undefined })),
      updateConversation: vi.fn()
    };
    const onUpdate = vi.fn();

    const ctx: MiddlewareContext = {
      sessionId: "s2",
      taskId: "t2",
      conversationId: "conv-2",
      workspacePath: "/tmp/workspace",
      messages: [{ role: "user", content: "帮我分析数据" }],
      tools: [],
      metadata: {},
      state: "after_agent",
      finalResponse: "这里是分析结果",
      runtime: {
        config,
        modelsFactory: modelsFactory as never,
        sandboxService: {} as never,
        conversationStore: conversationStore as never,
        onUpdate
      }
    };

    const result = await middleware.afterAgent!(ctx);

    // Wait for async title generation
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(modelsFactory.generateText).not.toHaveBeenCalled();
    expect(conversationStore.updateConversation).toHaveBeenCalledWith("conv-2", {
      title: "分析数据"
    });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(result.metadata.titleGenerated).toBeUndefined();
  });
});

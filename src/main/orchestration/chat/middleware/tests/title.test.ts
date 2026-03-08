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
      cronDir: path.join(workspaceDir, "cron"),
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
  it("writes temporary title first and then model-generated final title", async () => {
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
      messages: [{ role: "user", content: "帮我整理 Bandry 桌面端迁移方案和跨端数据同步策略及发布回滚预案。并拆成阶段目标和风险清单" }],
      tools: [],
      metadata: {},
      state: "after_agent",
      finalResponse:
        "这里是完整方案，包含迁移范围、阶段目标、依赖拆分、发布顺序、回滚预案以及每个阶段的主要风险与缓解建议。".repeat(3),
      runtime: {
        config,
        modelsFactory: modelsFactory as never,
        sandboxService: {} as never,
        conversationStore: conversationStore as never,
        onUpdate
      }
    };

    const result = await middleware.afterAgent!(ctx);
    await Promise.resolve();

    expect(modelsFactory.generateText).toHaveBeenCalledTimes(1);
    expect(conversationStore.updateConversation).toHaveBeenNthCalledWith(1, "conv-1", {
      title: "整理 Bandry 桌面端迁移方案和跨端数据同步策略及发布回滚预案"
    });
    expect(conversationStore.updateConversation).toHaveBeenNthCalledWith(2, "conv-1", {
      title: "Bandry Delegation Plan"
    });
    expect(onUpdate).not.toHaveBeenCalled();
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
      messages: [{ role: "user", content: "帮我分析最近三个月的数据走势、异常点和渠道波动，并整理成团队月度复盘标题" }],
      tools: [],
      metadata: {},
      state: "after_agent",
      finalResponse:
        "这里是一个比较完整的分析结果，包含核心趋势、分段变化、异常点以及后续建议，同时给出渠道贡献拆分和下一步验证动作。".repeat(3),
      runtime: {
        config,
        modelsFactory: modelsFactory as never,
        sandboxService: {} as never,
        conversationStore: conversationStore as never,
        onUpdate
      }
    };

    const result = await middleware.afterAgent!(ctx);
    await Promise.resolve();

    expect(modelsFactory.generateText).toHaveBeenCalledTimes(1);
    expect(conversationStore.updateConversation).toHaveBeenNthCalledWith(1, "conv-2", {
      title: "分析最近三个月的数据走势、异常点和渠道波动，并整理成团队月度复盘标题"
    });
    expect(conversationStore.updateConversation).toHaveBeenCalledTimes(1);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(result.metadata.titleGenerated).toBeUndefined();
  });

  it("skips model title generation for short conversations", async () => {
    const middleware = new TitleMiddleware();
    const config = createConfig();

    const modelsFactory = {
      generateText: vi.fn()
    };

    const conversationStore = {
      getConversation: vi.fn(() => ({ id: "conv-3", title: undefined })),
      updateConversation: vi.fn()
    };

    const ctx: MiddlewareContext = {
      sessionId: "s3",
      taskId: "t3",
      conversationId: "conv-3",
      workspacePath: "/tmp/workspace",
      messages: [{ role: "user", content: "今天天气怎么样？" }],
      tools: [],
      metadata: {},
      state: "after_agent",
      finalResponse: "今天晴，气温 26 度。",
      runtime: {
        config,
        modelsFactory: modelsFactory as never,
        sandboxService: {} as never,
        conversationStore: conversationStore as never,
        onUpdate: vi.fn()
      }
    };

    await middleware.afterAgent!(ctx);

    expect(modelsFactory.generateText).not.toHaveBeenCalled();
    expect(conversationStore.updateConversation).toHaveBeenCalledTimes(1);
    expect(conversationStore.updateConversation).toHaveBeenCalledWith("conv-3", {
      title: "今天天气怎么样"
    });
  });

  it("prefers non-reasoner routing target for title generation", async () => {
    const middleware = new TitleMiddleware();
    const config = createConfig();

    config.modelProfiles.push({
      id: "profile_deepseek_reasoner",
      name: "DeepSeek Reasoner",
      provider: "deepseek",
      model: "deepseek-reasoner",
      enabled: true
    });
    config.routing.assignments["chat.default"] = "profile_openai_default";
    config.routing.assignments["lead.planner"] = "profile_openai_default";
    config.routing.assignments["lead.synthesizer"] = "profile_deepseek_reasoner";

    const modelsFactory = {
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4.1-mini",
        text: "Monthly Data Trend Review",
        latencyMs: 10
      }))
    };

    const conversationStore = {
      getConversation: vi.fn(() => ({ id: "conv-4", title: undefined })),
      updateConversation: vi.fn()
    };

    const ctx: MiddlewareContext = {
      sessionId: "s4",
      taskId: "t4",
      conversationId: "conv-4",
      workspacePath: "/tmp/workspace",
      messages: [{ role: "user", content: "帮我总结最近三个月的核心指标变化并给个复盘标题" }],
      tools: [],
      metadata: {},
      state: "after_agent",
      finalResponse:
        "好的，我整理了最近三个月指标变化、关键拐点、异常渠道和后续行动建议，并给出适合团队复盘的标题候选。".repeat(2),
      runtime: {
        config,
        modelsFactory: modelsFactory as never,
        sandboxService: {} as never,
        conversationStore: conversationStore as never,
        onUpdate: vi.fn()
      }
    };

    await middleware.afterAgent!(ctx);
    await Promise.resolve();

    expect(modelsFactory.generateText).toHaveBeenCalledTimes(1);
    expect(modelsFactory.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gpt-4.1-mini"
      })
    );
  });

  it("skips model title generation when only reasoner routes are available", async () => {
    const middleware = new TitleMiddleware();
    const config = createConfig();

    config.modelProfiles = [
      {
        id: "profile_deepseek_reasoner",
        name: "DeepSeek Reasoner",
        provider: "deepseek",
        model: "deepseek-reasoner",
        enabled: true
      }
    ];
    config.providers.deepseek.apiKey = "sk-deepseek-valid-key-1234567890";
    config.routing.assignments["chat.default"] = "profile_deepseek_reasoner";
    config.routing.assignments["lead.planner"] = "profile_deepseek_reasoner";
    config.routing.assignments["lead.synthesizer"] = "profile_deepseek_reasoner";
    config.routing.assignments["memory.fact_extractor"] = "profile_deepseek_reasoner";

    const modelsFactory = {
      generateText: vi.fn()
    };

    const conversationStore = {
      getConversation: vi.fn(() => ({ id: "conv-5", title: undefined })),
      updateConversation: vi.fn()
    };

    const ctx: MiddlewareContext = {
      sessionId: "s5",
      taskId: "t5",
      conversationId: "conv-5",
      workspacePath: "/tmp/workspace",
      messages: [{ role: "user", content: "请帮我总结这次发布的风险和回滚策略" }],
      tools: [],
      metadata: {},
      state: "after_agent",
      finalResponse: "已总结主要风险、监控点和回滚步骤。",
      runtime: {
        config,
        modelsFactory: modelsFactory as never,
        sandboxService: {} as never,
        conversationStore: conversationStore as never,
        onUpdate: vi.fn()
      }
    };

    await middleware.afterAgent!(ctx);
    await Promise.resolve();

    expect(modelsFactory.generateText).not.toHaveBeenCalled();
    expect(conversationStore.updateConversation).toHaveBeenCalledTimes(1);
  });
});

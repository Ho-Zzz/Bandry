import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createDefaultConfig } from "../../../config/default-config";
import { ChatAgentFactory } from "../chat-agent-factory";

const createConfig = () => {
  const workspaceDir = path.resolve("/tmp/bandry-chat-agent-factory");
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
      databasePath: path.join(workspaceDir, "bandry.db")
    },
    runtime: {
      inheritedEnv: {}
    }
  });

  config.providers.openai.apiKey = "sk-openai-valid-key-1234567890";
  config.modelProfiles = [
    {
      id: "profile_openai_reasoning",
      name: "OpenAI reasoning",
      provider: "openai",
      model: "gpt-5-mini",
      enabled: true,
      capabilities: {
        supportsThinking: true,
        supportsReasoningEffort: true
      },
      whenThinkingEnabled: {
        extraBody: {
          thinking: { type: "enabled" },
          serviceTier: "auto"
        },
        reasoningEffort: "high"
      }
    },
    {
      id: "profile_openai_fast",
      name: "OpenAI fast",
      provider: "openai",
      model: "gpt-4.1-mini",
      enabled: true,
      capabilities: {
        supportsThinking: false,
        supportsReasoningEffort: false
      }
    }
  ];
  config.routing.assignments["lead.planner"] = "profile_openai_reasoning";
  config.routing.assignments["chat.default"] = "profile_openai_reasoning";

  return config;
};

describe("ChatAgentFactory", () => {
  it("creates a fresh ToolPlanningChatAgent instance for each createAgent call", () => {
    const config = createConfig();
    const factory = new ChatAgentFactory({
      config,
      modelsFactory: {} as never,
      sandboxService: {} as never,
      conversationStore: {
        getConversation: vi.fn(() => null)
      } as never
    });

    const first = factory.createAgent({ modelProfileId: "profile_openai_reasoning" });
    const second = factory.createAgent({ modelProfileId: "profile_openai_reasoning" });

    expect(first.agent).not.toBe(second.agent);
  });

  it("applies thinking extras and records downgrade warnings for unsupported extraBody keys", () => {
    const config = createConfig();
    const factory = new ChatAgentFactory({
      config,
      modelsFactory: {} as never,
      sandboxService: {} as never,
      conversationStore: {
        getConversation: vi.fn(() => null)
      } as never
    });

    const context = factory.createContext({
      modelProfileId: "profile_openai_reasoning",
      thinkingEnabled: true
    });

    expect(context.thinkingEnabled).toBe(true);
    expect(context.apiExtras.reasoningEffort).toBe("high");
    expect(context.apiExtras.extraBody).toEqual({
      serviceTier: "auto"
    });
    expect(context.warnings.some((item) => item.includes("thinking"))).toBe(true);
  });

  it("forces thinking enabled when mode is thinking", () => {
    const config = createConfig();
    const factory = new ChatAgentFactory({
      config,
      modelsFactory: {} as never,
      sandboxService: {} as never,
      conversationStore: {
        getConversation: vi.fn(() => null)
      } as never
    });

    const context = factory.createContext({
      modelProfileId: "profile_openai_reasoning",
      mode: "thinking",
      thinkingEnabled: false
    });

    expect(context.thinkingEnabled).toBe(true);
  });

  it("uses minimal reasoning effort when thinking is explicitly disabled", () => {
    const config = createConfig();
    const factory = new ChatAgentFactory({
      config,
      modelsFactory: {} as never,
      sandboxService: {} as never,
      conversationStore: {
        getConversation: vi.fn(() => null)
      } as never
    });

    const context = factory.createContext({
      modelProfileId: "profile_openai_reasoning",
      thinkingEnabled: false
    });

    expect(context.apiExtras.reasoningEffort).toBe("minimal");
    expect(context.warnings.some((item) => item.includes("disable-thinking"))).toBe(true);
  });

  it("lets explicit reasoning effort override profile defaults", () => {
    const config = createConfig();
    const factory = new ChatAgentFactory({
      config,
      modelsFactory: {} as never,
      sandboxService: {} as never,
      conversationStore: {
        getConversation: vi.fn(() => null)
      } as never
    });

    const context = factory.createContext({
      modelProfileId: "profile_openai_reasoning",
      thinkingEnabled: true,
      reasoningEffort: "low"
    });

    expect(context.apiExtras.reasoningEffort).toBe("low");
  });

  it("resolves model profile from conversation when request does not provide profile id", () => {
    const config = createConfig();
    const getConversation = vi.fn(() => ({
      id: "conv_1",
      model_profile_id: "profile_openai_reasoning"
    }));
    const factory = new ChatAgentFactory({
      config,
      modelsFactory: {} as never,
      sandboxService: {} as never,
      conversationStore: {
        getConversation
      } as never
    });

    const context = factory.createContext({
      conversationId: "conv_1"
    });

    expect(context.modelProfileId).toBe("profile_openai_reasoning");
    expect(getConversation).toHaveBeenCalledWith("conv_1");
  });
});

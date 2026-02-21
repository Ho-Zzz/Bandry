import type { AppConfig, AppPaths, RuntimeConfig } from "./types";

type CreateDefaultConfigInput = {
  paths: AppPaths;
  runtime: RuntimeConfig;
};

export const createDefaultConfig = (
  input: CreateDefaultConfigInput
): AppConfig => {
  const defaultProfiles: AppConfig["modelProfiles"] = [
    {
      id: "profile_openai_default",
      name: "OpenAI Default",
      provider: "openai",
      model: "gpt-4.1-mini",
      enabled: true,
      temperature: 0.2
    },
    {
      id: "profile_deepseek_default",
      name: "DeepSeek Default",
      provider: "deepseek",
      model: "deepseek-chat",
      enabled: true,
      temperature: 0.2
    },
    {
      id: "profile_volcengine_default",
      name: "Volcengine Default",
      provider: "volcengine",
      model: "doubao-seed-1-6-250615",
      enabled: true,
      temperature: 0.2
    }
  ];

  return {
    llm: {
      defaultProvider: "openai",
      defaultModel: "gpt-4.1-mini",
      timeoutMs: 60_000,
      maxRetries: 3,
      retryBaseMs: 500,
      rateLimitRps: 2,
      networkMode: "auto",
      offlineNonModelOnly: true,
      auditLogEnabled: true,
      piiRedactionEnabled: true,
    },
    sandbox: {
      virtualRoot: "/mnt/workspace",
      allowedWorkspaces: [input.paths.workspaceDir],
      allowedCommands: ["ls", "cat", "mkdir", "echo"],
      execTimeoutMs: 30_000,
      maxOutputBytes: 64 * 1024,
      auditLogEnabled: true,
    },
    providers: {
      openai: {
        enabled: true,
        apiKey: "",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4.1-mini",
        orgId: "",
      },
      deepseek: {
        enabled: true,
        apiKey: "",
        baseUrl: "https://api.deepseek.com",
        model: "deepseek-chat",
      },
      volcengine: {
        enabled: true,
        apiKey: "",
        baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
        model: "doubao-seed-1-6-250615",
      },
    },
    features: {
      enableMiddleware: false,
      enableMultiAgent: false,
      enableMemory: false,
      enableMCP: false,
    },
    openviking: {
      enabled: true,
      host: "127.0.0.1",
      port: 1933,
      apiKey: "",
      serverCommand: "openviking",
      serverArgs: ["serve"],
      startTimeoutMs: 20_000,
      healthcheckIntervalMs: 500,
      memoryTopK: 6,
      memoryScoreThreshold: 0.35,
      commitDebounceMs: 30_000,
      targetUris: ["viking://user/memories", "viking://agent/memories"],
    },
    modelProfiles: defaultProfiles,
    routing: {
      assignments: {
        "chat.default": "profile_openai_default",
        "lead.planner": "profile_openai_default",
        "lead.synthesizer": "profile_openai_default",
        "sub.researcher": "profile_openai_default",
        "sub.bash_operator": "profile_openai_default",
        "sub.writer": "profile_openai_default",
        "memory.fact_extractor": "profile_openai_default"
      }
    },
    tools: {
      webSearch: {
        enabled: false,
        provider: "tavily",
        apiKey: "",
        baseUrl: "https://api.tavily.com",
        timeoutMs: 15_000,
        maxResults: 5
      },
      webFetch: {
        enabled: false,
        provider: "jina",
        apiKey: "",
        baseUrl: "https://r.jina.ai/http://",
        timeoutMs: 15_000
      }
    },
    paths: input.paths,
    runtime: input.runtime
  };
};

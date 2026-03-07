import type { AppConfig, AppPaths, RuntimeConfig } from "./types";
import {
  MODEL_PROVIDER_DEFAULTS,
  MODEL_PROVIDERS
} from "../../shared/model-providers";

type CreateDefaultConfigInput = {
  paths: AppPaths;
  runtime: RuntimeConfig;
};

export const createDefaultConfig = (
  input: CreateDefaultConfigInput
): AppConfig => {
  const defaultProviders = Object.fromEntries(
    MODEL_PROVIDERS.map((provider) => {
      const defaults = MODEL_PROVIDER_DEFAULTS[provider];
      return [
        provider,
        {
          enabled: true,
          apiKey: "",
          baseUrl: defaults.baseUrl,
          model: defaults.model,
          embeddingModel: defaults.embeddingModel,
          ...(defaults.orgId !== undefined ? { orgId: defaults.orgId } : {})
        }
      ];
    })
  ) as AppConfig["providers"];

  const defaultProfiles: AppConfig["modelProfiles"] = [];

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
    subagent: {
      maxConcurrent: 3,
      timeoutMs: 900_000 // 15 minutes
    },
    providers: defaultProviders,
    features: {
      enableMemory: false,
      enableMCP: false,
      enableSkills: true,
      enableSoul: true,
    },
    openviking: {
      enabled: true,
      host: "127.0.0.1",
      port: 1933,
      apiKey: "",
      vlmProfileId: "",
      embeddingProfileId: "",
      serverCommand: "openviking-server",
      serverArgs: [],
      startTimeoutMs: 20_000,
      healthcheckIntervalMs: 500,
      memoryTopK: 6,
      memoryScoreThreshold: 0.35,
      commitDebounceMs: 30_000,
      targetUris: ["viking://user/memories", "viking://agent/memories"],
    },
    catalog: {
      source: {
        type: "http",
        location: "https://models.dev/api.json",
        schema: "models.dev",
        timeoutMs: 12_000
      }
    },
    modelProfiles: defaultProfiles,
    routing: {
      assignments: {
        "chat.default": "",
        "lead.planner": "",
        "lead.synthesizer": "",
        "sub.researcher": "",
        "sub.bash_operator": "",
        "sub.writer": "",
        "memory.fact_extractor": ""
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
      },
      githubSearch: {
        enabled: true,
        apiKey: "",
        baseUrl: "https://api.github.com",
        timeoutMs: 15_000,
        maxResults: 10
      }
    },
    channels: {
      enabled: false,
      channels: []
    },
    paths: input.paths,
    runtime: input.runtime
  };
};

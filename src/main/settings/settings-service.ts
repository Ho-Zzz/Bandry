import fs from "node:fs/promises";
import path from "node:path";
import { type AppConfig, type RuntimeRole } from "../config";
import { normalizeConfig } from "../config/normalize-config";
import type {
  GlobalSettingsState,
  SaveSettingsInput,
  SaveSettingsResult
} from "../../shared/ipc";

type SettingsServiceOptions = {
  config: AppConfig;
};

const RUNTIME_ROLES: RuntimeRole[] = [
  "chat.default",
  "lead.planner",
  "lead.synthesizer",
  "sub.researcher",
  "sub.bash_operator",
  "sub.writer",
  "memory.fact_extractor"
];

const toGlobalSettingsState = (config: AppConfig): GlobalSettingsState => {
  return {
    providers: {
      openai: {
        enabled: config.providers.openai.enabled,
        apiKey: config.providers.openai.apiKey,
        baseUrl: config.providers.openai.baseUrl,
        model: config.providers.openai.model,
        orgId: config.providers.openai.orgId
      },
      deepseek: {
        enabled: config.providers.deepseek.enabled,
        apiKey: config.providers.deepseek.apiKey,
        baseUrl: config.providers.deepseek.baseUrl,
        model: config.providers.deepseek.model
      },
      volcengine: {
        enabled: config.providers.volcengine.enabled,
        apiKey: config.providers.volcengine.apiKey,
        baseUrl: config.providers.volcengine.baseUrl,
        model: config.providers.volcengine.model
      }
    },
    modelProfiles: config.modelProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      provider: profile.provider,
      model: profile.model,
      enabled: profile.enabled,
      temperature: profile.temperature,
      maxTokens: profile.maxTokens
    })),
    routing: { ...config.routing.assignments },
    memory: {
      enableMemory: config.features.enableMemory,
      openviking: {
        enabled: config.openviking.enabled,
        host: config.openviking.host,
        port: config.openviking.port,
        apiKey: config.openviking.apiKey,
        serverCommand: config.openviking.serverCommand,
        serverArgs: config.openviking.serverArgs,
        startTimeoutMs: config.openviking.startTimeoutMs,
        healthcheckIntervalMs: config.openviking.healthcheckIntervalMs,
        memoryTopK: config.openviking.memoryTopK,
        memoryScoreThreshold: config.openviking.memoryScoreThreshold,
        commitDebounceMs: config.openviking.commitDebounceMs,
        targetUris: config.openviking.targetUris
      }
    },
    tools: {
      webSearch: {
        enabled: config.tools.webSearch.enabled,
        apiKey: config.tools.webSearch.apiKey,
        baseUrl: config.tools.webSearch.baseUrl,
        timeoutMs: config.tools.webSearch.timeoutMs,
        maxResults: config.tools.webSearch.maxResults
      },
      webFetch: {
        enabled: config.tools.webFetch.enabled,
        apiKey: config.tools.webFetch.apiKey,
        baseUrl: config.tools.webFetch.baseUrl,
        timeoutMs: config.tools.webFetch.timeoutMs
      }
    }
  };
};

const validateState = (state: GlobalSettingsState): string[] => {
  const errors: string[] = [];

  if (state.modelProfiles.length === 0) {
    errors.push("至少需要一个模型档案");
  }

  const profileIds = new Set(state.modelProfiles.map((profile) => profile.id));
  for (const role of Object.keys(state.routing)) {
    const profileId = state.routing[role as keyof GlobalSettingsState["routing"]];
    if (!profileIds.has(profileId)) {
      errors.push(`角色 ${role} 绑定的模型档案不存在: ${profileId}`);
    }
  }

  const duplicated = new Set<string>();
  for (const profile of state.modelProfiles) {
    if (!profile.id.trim()) {
      errors.push("模型档案 id 不能为空");
    }
    if (!profile.name.trim()) {
      errors.push(`模型档案 ${profile.id} 名称不能为空`);
    }
    if (!profile.model.trim()) {
      errors.push(`模型档案 ${profile.id} model 不能为空`);
    }
    if (duplicated.has(profile.id)) {
      errors.push(`模型档案 id 重复: ${profile.id}`);
    }
    duplicated.add(profile.id);
  }

  return errors;
};

export class SettingsService {
  constructor(private readonly options: SettingsServiceOptions) {}

  getState(): GlobalSettingsState {
    return toGlobalSettingsState(this.options.config);
  }

  async saveState(input: SaveSettingsInput): Promise<SaveSettingsResult> {
    const errors = validateState(input.state);
    if (errors.length > 0) {
      return {
        ok: false,
        requiresRestart: false,
        message: errors.join("; ")
      };
    }

    const chatProfile = input.state.modelProfiles.find((profile) => profile.id === input.state.routing["chat.default"]);

    const userLayer = {
      llm: {
        defaultProvider: chatProfile?.provider,
        defaultModel: chatProfile?.model
      },
      providers: {
        openai: {
          enabled: input.state.providers.openai.enabled,
          apiKey: input.state.providers.openai.apiKey,
          baseUrl: input.state.providers.openai.baseUrl,
          model: input.state.providers.openai.model,
          orgId: input.state.providers.openai.orgId
        },
        deepseek: {
          enabled: input.state.providers.deepseek.enabled,
          apiKey: input.state.providers.deepseek.apiKey,
          baseUrl: input.state.providers.deepseek.baseUrl,
          model: input.state.providers.deepseek.model
        },
        volcengine: {
          enabled: input.state.providers.volcengine.enabled,
          apiKey: input.state.providers.volcengine.apiKey,
          baseUrl: input.state.providers.volcengine.baseUrl,
          model: input.state.providers.volcengine.model
        }
      },
      features: {
        enableMemory: input.state.memory.enableMemory
      },
      openviking: input.state.memory.openviking,
      modelProfiles: input.state.modelProfiles,
      routing: {
        assignments: input.state.routing
      },
      tools: {
        webSearch: {
          enabled: input.state.tools.webSearch.enabled,
          provider: "tavily",
          apiKey: input.state.tools.webSearch.apiKey,
          baseUrl: input.state.tools.webSearch.baseUrl,
          timeoutMs: input.state.tools.webSearch.timeoutMs,
          maxResults: input.state.tools.webSearch.maxResults
        },
        webFetch: {
          enabled: input.state.tools.webFetch.enabled,
          provider: "jina",
          apiKey: input.state.tools.webFetch.apiKey,
          baseUrl: input.state.tools.webFetch.baseUrl,
          timeoutMs: input.state.tools.webFetch.timeoutMs
        }
      }
    };

    const userConfigPath = this.options.config.paths.userConfigPath;
    await fs.mkdir(path.dirname(userConfigPath), { recursive: true });
    await fs.writeFile(userConfigPath, JSON.stringify(userLayer, null, 2), "utf8");

    const currentConfig = this.options.config;
    currentConfig.llm.defaultProvider = chatProfile?.provider ?? currentConfig.llm.defaultProvider;
    currentConfig.llm.defaultModel = chatProfile?.model ?? currentConfig.llm.defaultModel;

    currentConfig.providers.openai = {
      ...currentConfig.providers.openai,
      enabled: input.state.providers.openai.enabled,
      apiKey: input.state.providers.openai.apiKey,
      baseUrl: input.state.providers.openai.baseUrl,
      model: input.state.providers.openai.model,
      orgId: input.state.providers.openai.orgId
    };
    currentConfig.providers.deepseek = {
      ...currentConfig.providers.deepseek,
      enabled: input.state.providers.deepseek.enabled,
      apiKey: input.state.providers.deepseek.apiKey,
      baseUrl: input.state.providers.deepseek.baseUrl,
      model: input.state.providers.deepseek.model
    };
    currentConfig.providers.volcengine = {
      ...currentConfig.providers.volcengine,
      enabled: input.state.providers.volcengine.enabled,
      apiKey: input.state.providers.volcengine.apiKey,
      baseUrl: input.state.providers.volcengine.baseUrl,
      model: input.state.providers.volcengine.model
    };

    currentConfig.features.enableMemory = input.state.memory.enableMemory;
    currentConfig.openviking = {
      ...input.state.memory.openviking
    };

    currentConfig.modelProfiles = input.state.modelProfiles.map((profile) => ({
      ...profile
    }));
    currentConfig.routing.assignments = {
      ...input.state.routing
    };

    currentConfig.tools.webSearch = {
      ...currentConfig.tools.webSearch,
      enabled: input.state.tools.webSearch.enabled,
      provider: "tavily",
      apiKey: input.state.tools.webSearch.apiKey,
      baseUrl: input.state.tools.webSearch.baseUrl,
      timeoutMs: input.state.tools.webSearch.timeoutMs,
      maxResults: input.state.tools.webSearch.maxResults
    };
    currentConfig.tools.webFetch = {
      ...currentConfig.tools.webFetch,
      enabled: input.state.tools.webFetch.enabled,
      provider: "jina",
      apiKey: input.state.tools.webFetch.apiKey,
      baseUrl: input.state.tools.webFetch.baseUrl,
      timeoutMs: input.state.tools.webFetch.timeoutMs
    };

    normalizeConfig(currentConfig);
    this.ensureRuntimeAssignments();

    return {
      ok: true,
      requiresRestart: true,
      message: "配置已保存。部分模块（如沙盒与进程管理）建议重启应用后生效。"
    };
  }

  ensureRuntimeAssignments(): void {
    const routing = this.options.config.routing.assignments;
    const fallback = this.options.config.modelProfiles[0]?.id ?? "profile_openai_default";
    for (const role of RUNTIME_ROLES) {
      if (!routing[role]) {
        routing[role] = fallback;
      }
    }
  }
}

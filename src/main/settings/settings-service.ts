import fs from "node:fs/promises";
import path from "node:path";
import { type AppConfig } from "../config";
import { hasUsableProviderApiKey } from "../config/provider-credential";
import { normalizeConfig } from "../config/normalize-config";
import type {
  GlobalSettingsState,
  SaveSettingsInput,
  SaveSettingsResult,
  SettingsChannelItem
} from "../../shared/ipc";

type SettingsServiceOptions = {
  config: AppConfig;
};

const OPENVIKING_ALLOWED_PROVIDERS = new Set(["openai", "volcengine"]);

const normalizeChannelId = (rawId: string, index: number): string => {
  const normalized = rawId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `channel_${index + 1}`;
};

const toSettingsProviders = (
  providers: AppConfig["providers"]
): GlobalSettingsState["providers"] => {
  return Object.fromEntries(
    Object.entries(providers).map(([provider, config]) => [
      provider,
      {
        enabled: config.enabled,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        embeddingModel: config.embeddingModel,
        ...(config.orgId !== undefined ? { orgId: config.orgId } : {})
      }
    ])
  ) as GlobalSettingsState["providers"];
};

const toConfigProvidersLayer = (
  providers: GlobalSettingsState["providers"]
): {
  [provider: string]: {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
    model: string;
    embeddingModel: string;
    orgId?: string;
  };
} => {
  return Object.fromEntries(
    Object.entries(providers).map(([provider, config]) => [
      provider,
      {
        enabled: config.enabled,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        embeddingModel: config.embeddingModel,
        ...(config.orgId !== undefined ? { orgId: config.orgId } : {})
      }
    ])
  );
};

const toGlobalSettingsState = (config: AppConfig): GlobalSettingsState => {
  const channels: SettingsChannelItem[] = config.channels.channels.map((channel, index) => ({
    id: normalizeChannelId(channel.id ?? "", index),
    ...(channel.name?.trim() ? { name: channel.name.trim() } : {}),
    type: "feishu",
    appId: channel.appId,
    appSecret: channel.appSecret,
    allowedChatIds: [...(channel.allowedChatIds ?? [])],
    enabled: channel.enabled !== false
  }));

  return {
    providers: toSettingsProviders(config.providers),
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
        vlmProfileId: config.openviking.vlmProfileId,
        embeddingProfileId: config.openviking.embeddingProfileId,
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
      },
      githubSearch: {
        enabled: config.tools.githubSearch.enabled,
        apiKey: config.tools.githubSearch.apiKey,
        baseUrl: config.tools.githubSearch.baseUrl,
        timeoutMs: config.tools.githubSearch.timeoutMs,
        maxResults: config.tools.githubSearch.maxResults
      }
    },
    channels: {
      enabled: config.channels.enabled,
      channels
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
    const profileId = state.routing[role as keyof GlobalSettingsState["routing"]]?.trim();
    if (!profileId) {
      continue;
    }
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

  if (state.memory.enableMemory && state.memory.openviking.enabled) {
    const profilesById = new Map(state.modelProfiles.map((profile) => [profile.id, profile]));
    for (const [field, profileId] of [
      ["vlmProfileId", state.memory.openviking.vlmProfileId],
      ["embeddingProfileId", state.memory.openviking.embeddingProfileId]
    ] as const) {
      const id = profileId.trim();
      if (!id) {
        errors.push(`OpenViking ${field} 未配置`);
        continue;
      }

      const profile = profilesById.get(id);
      if (!profile) {
        errors.push(`OpenViking ${field} 指向不存在的模型档案: ${id}`);
        continue;
      }
      if (!profile.enabled) {
        errors.push(`OpenViking ${field} 指向的模型档案未启用: ${id}`);
      }
      if (!OPENVIKING_ALLOWED_PROVIDERS.has(profile.provider)) {
        errors.push(`OpenViking ${field} 仅支持 OpenAI/Volcengine: ${id}`);
        continue;
      }

      const provider = state.providers[profile.provider];
      if (!provider || !hasUsableProviderApiKey(profile.provider, provider.apiKey)) {
        errors.push(`OpenViking ${field} 的 provider 凭证不可用: ${profile.provider}`);
      }
    }
  }

  const channelIds = new Set<string>();
  for (let index = 0; index < state.channels.channels.length; index += 1) {
    const channel = state.channels.channels[index];
    const normalizedId = normalizeChannelId(channel.id, index);
    if (channelIds.has(normalizedId)) {
      errors.push(`Channel id 重复: ${normalizedId}`);
    }
    channelIds.add(normalizedId);

    if (channel.type !== "feishu") {
      errors.push(`暂不支持的 channel 类型: ${channel.type}`);
      continue;
    }

    if (channel.enabled) {
      if (!channel.appId.trim()) {
        errors.push(`Channel ${normalizedId} 的 appId 不能为空`);
      }
      if (!channel.appSecret.trim()) {
        errors.push(`Channel ${normalizedId} 的 appSecret 不能为空`);
      }
    }
  }

  if (state.channels.enabled) {
    const hasEnabledChannel = state.channels.channels.some((channel) => channel.enabled);
    if (!hasEnabledChannel) {
      errors.push("启用 Channels 时，至少需要一个启用中的 Channel 配置");
    }
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
      providers: toConfigProvidersLayer(input.state.providers),
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
        },
        githubSearch: {
          enabled: input.state.tools.githubSearch.enabled,
          apiKey: input.state.tools.githubSearch.apiKey,
          baseUrl: input.state.tools.githubSearch.baseUrl,
          timeoutMs: input.state.tools.githubSearch.timeoutMs,
          maxResults: input.state.tools.githubSearch.maxResults
        }
      },
      channels: {
        enabled: input.state.channels.enabled,
        channels: input.state.channels.channels.map((channel, index) => ({
          id: normalizeChannelId(channel.id, index),
          ...(channel.name?.trim() ? { name: channel.name.trim() } : {}),
          type: "feishu" as const,
          appId: channel.appId.trim(),
          appSecret: channel.appSecret.trim(),
          allowedChatIds: Array.from(
            new Set(channel.allowedChatIds.map((item) => item.trim()).filter(Boolean))
          ),
          enabled: channel.enabled
        }))
      },
      catalog: {
        source: {
          type: this.options.config.catalog.source.type,
          location: this.options.config.catalog.source.location,
          schema: this.options.config.catalog.source.schema,
          timeoutMs: this.options.config.catalog.source.timeoutMs
        }
      }
    };

    const userConfigPath = this.options.config.paths.userConfigPath;
    await fs.mkdir(path.dirname(userConfigPath), { recursive: true });
    await fs.writeFile(userConfigPath, JSON.stringify(userLayer, null, 2), "utf8");

    const currentConfig = this.options.config;
    currentConfig.llm.defaultProvider = chatProfile?.provider ?? currentConfig.llm.defaultProvider;
    currentConfig.llm.defaultModel = chatProfile?.model ?? currentConfig.llm.defaultModel;

    for (const [provider, providerInput] of Object.entries(input.state.providers)) {
      const providerConfig = currentConfig.providers[provider as keyof AppConfig["providers"]];
      providerConfig.enabled = providerInput.enabled;
      providerConfig.apiKey = providerInput.apiKey;
      providerConfig.baseUrl = providerInput.baseUrl;
      providerConfig.model = providerInput.model;
      providerConfig.embeddingModel = providerInput.embeddingModel;
      providerConfig.orgId = providerInput.orgId;
    }

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
    currentConfig.tools.githubSearch = {
      ...currentConfig.tools.githubSearch,
      enabled: input.state.tools.githubSearch.enabled,
      apiKey: input.state.tools.githubSearch.apiKey,
      baseUrl: input.state.tools.githubSearch.baseUrl,
      timeoutMs: input.state.tools.githubSearch.timeoutMs,
      maxResults: input.state.tools.githubSearch.maxResults
    };
    currentConfig.channels = {
      enabled: input.state.channels.enabled,
      channels: input.state.channels.channels.map((channel, index) => ({
        id: normalizeChannelId(channel.id, index),
        ...(channel.name?.trim() ? { name: channel.name.trim() } : {}),
        type: "feishu",
        appId: channel.appId.trim(),
        appSecret: channel.appSecret.trim(),
        allowedChatIds: Array.from(
          new Set(channel.allowedChatIds.map((item) => item.trim()).filter(Boolean))
        ),
        enabled: channel.enabled
      }))
    };

    normalizeConfig(currentConfig);

    return {
      ok: true,
      requiresRestart: false,
      message: "配置已保存，Memory/工具/Channels 配置已即时生效。"
    };
  }
}

import type { AppConfig, LlmProvider, PublicConfigSummary } from "./types";

export const toPublicConfigSummary = (config: AppConfig): PublicConfigSummary => {
  return {
    defaultProvider: config.llm.defaultProvider,
    defaultModel: config.llm.defaultModel,
    timeoutMs: config.llm.timeoutMs,
    maxRetries: config.llm.maxRetries,
    networkMode: config.llm.networkMode,
    sandbox: {
      virtualRoot: config.sandbox.virtualRoot,
      allowedWorkspaces: config.sandbox.allowedWorkspaces,
      allowedCommands: config.sandbox.allowedCommands,
      execTimeoutMs: config.sandbox.execTimeoutMs,
      maxOutputBytes: config.sandbox.maxOutputBytes,
      auditLogEnabled: config.sandbox.auditLogEnabled
    },
    providers: (Object.entries(config.providers) as Array<[LlmProvider, AppConfig["providers"][LlmProvider]]>).map(
      ([name, provider]) => ({
        name,
        enabled: provider.enabled,
        configured: provider.apiKey.trim().length > 0,
        baseUrl: provider.baseUrl,
        model: provider.model
      })
    ),
    modelProfiles: config.modelProfiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      provider: profile.provider,
      model: profile.model,
      enabled: profile.enabled
    })),
    routing: { ...config.routing.assignments },
    tools: {
      webSearchEnabled: config.tools.webSearch.enabled,
      webFetchEnabled: config.tools.webFetch.enabled
    }
  };
};

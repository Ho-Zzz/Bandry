import type { ModelProvider } from "../../shared/model-providers";

export type LlmProvider = ModelProvider;

export type NetworkMode = "auto" | "online" | "offline";

export type RuntimeRole =
  | "chat.default"
  | "lead.planner"
  | "lead.synthesizer"
  | "sub.researcher"
  | "sub.bash_operator"
  | "sub.writer"
  | "memory.fact_extractor";

export type ModelProfile = {
  id: string;
  name: string;
  provider: LlmProvider;
  model: string;
  enabled: boolean;
  temperature?: number;
  maxTokens?: number;
};

export type ModelProfileLayer = Partial<ModelProfile> & Pick<ModelProfile, "id">;

export type RoutingConfig = {
  assignments: Record<RuntimeRole, string>;
};

export type RoutingLayerConfig = Partial<{
  assignments: Partial<Record<RuntimeRole, string>>;
}>;

export type InternalWebSearchConfig = {
  enabled: boolean;
  provider: "tavily";
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxResults: number;
};

export type InternalWebFetchConfig = {
  enabled: boolean;
  provider: "jina";
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
};

export type InternalGitHubSearchConfig = {
  enabled: boolean;
  /** GitHub personal access token (optional, increases rate limit) */
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxResults: number;
};

export type InternalToolsConfig = {
  webSearch: InternalWebSearchConfig;
  webFetch: InternalWebFetchConfig;
  githubSearch: InternalGitHubSearchConfig;
};

export type InternalToolsLayerConfig = Partial<{
  webSearch: Partial<InternalWebSearchConfig>;
  webFetch: Partial<InternalWebFetchConfig>;
  githubSearch: Partial<InternalGitHubSearchConfig>;
}>;

export type CatalogSourceType = "http" | "file";
export type CatalogSourceSchema = "models.dev";

export type CatalogSourceConfig = {
  type: CatalogSourceType;
  location: string;
  schema: CatalogSourceSchema;
  timeoutMs: number;
};

export type CatalogSourceLayerConfig = Partial<{
  type: CatalogSourceType;
  location: string;
  schema: CatalogSourceSchema;
  timeoutMs: number;
}>;

export type AppPaths = {
  projectRoot: string;
  bandryHome: string;
  configDir: string;
  logsDir: string;
  workspaceDir: string;
  workspacesDir: string;
  resourcesDir: string;
  pluginsDir: string;
  traceDir: string;
  projectConfigPath: string;
  userConfigPath: string;
  auditLogPath: string;
  sandboxAuditLogPath: string;
  databasePath: string;
  dotenvPath: string;
};

export type RuntimeConfig = {
  devServerUrl?: string;
  inheritedEnv: Record<string, string>;
};

export type ProviderLayerConfig = Partial<{
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  orgId: string;
}>;

export type SandboxLayerConfig = Partial<{
  virtualRoot: string;
  allowedWorkspaces: string[];
  allowedCommands: string[];
  execTimeoutMs: number;
  maxOutputBytes: number;
  auditLogEnabled: boolean;
}>;

export type LlmLayerConfig = Partial<{
  defaultProvider: LlmProvider | "bytedance";
  defaultModel: string;
  timeoutMs: number;
  maxRetries: number;
  retryBaseMs: number;
  rateLimitRps: number;
  networkMode: NetworkMode;
  offlineNonModelOnly: boolean;
  auditLogEnabled: boolean;
  piiRedactionEnabled: boolean;
}>;

export type FeaturesLayerConfig = Partial<{
  enableMemory: boolean;
  enableMCP: boolean;
}>;

export type OpenVikingLayerConfig = Partial<{
  enabled: boolean;
  host: string;
  port: number;
  apiKey: string;
  serverCommand: string;
  serverArgs: string[];
  startTimeoutMs: number;
  healthcheckIntervalMs: number;
  memoryTopK: number;
  memoryScoreThreshold: number;
  commitDebounceMs: number;
  targetUris: string[];
}>;

export type PathsLayerConfig = Partial<
  Pick<
    AppPaths,
    | "bandryHome"
    | "configDir"
    | "logsDir"
    | "workspaceDir"
    | "workspacesDir"
    | "resourcesDir"
    | "pluginsDir"
    | "traceDir"
    | "auditLogPath"
    | "sandboxAuditLogPath"
    | "databasePath"
  >
>;

export type ConfigLayer = {
  llm?: LlmLayerConfig;
  sandbox?: SandboxLayerConfig;
  providers?: Partial<Record<LlmProvider | "bytedance", ProviderLayerConfig>>;
  features?: FeaturesLayerConfig;
  openviking?: OpenVikingLayerConfig;
  paths?: PathsLayerConfig;
  catalog?: {
    source?: CatalogSourceLayerConfig;
  };
  modelProfiles?: ModelProfileLayer[];
  routing?: RoutingLayerConfig;
  tools?: InternalToolsLayerConfig;
};

export type ProviderConfig = {
  enabled: boolean;
  apiKey: string;
  baseUrl: string;
  model: string;
  orgId?: string;
};

export type AppConfig = {
  llm: {
    defaultProvider: LlmProvider;
    defaultModel: string;
    timeoutMs: number;
    maxRetries: number;
    retryBaseMs: number;
    rateLimitRps: number;
    networkMode: NetworkMode;
    offlineNonModelOnly: boolean;
    auditLogEnabled: boolean;
    piiRedactionEnabled: boolean;
  };
  sandbox: {
    virtualRoot: string;
    allowedWorkspaces: string[];
    allowedCommands: string[];
    execTimeoutMs: number;
    maxOutputBytes: number;
    auditLogEnabled: boolean;
  };
  /** Sub-agent configuration for subagents mode */
  subagent: {
    /** Maximum concurrent sub-agents (2-5, default 3) */
    maxConcurrent: number;
    /** Sub-agent execution timeout in ms (default 900000 = 15min) */
    timeoutMs: number;
  };
  providers: Record<LlmProvider, ProviderConfig>;
  features: {
    enableMemory: boolean;
    enableMCP: boolean;
  };
  openviking: {
    enabled: boolean;
    host: string;
    port: number;
    apiKey: string;
    serverCommand: string;
    serverArgs: string[];
    startTimeoutMs: number;
    healthcheckIntervalMs: number;
    memoryTopK: number;
    memoryScoreThreshold: number;
    commitDebounceMs: number;
    targetUris: string[];
  };
  catalog: {
    source: CatalogSourceConfig;
  };
  modelProfiles: ModelProfile[];
  routing: RoutingConfig;
  tools: InternalToolsConfig;
  paths: AppPaths;
  runtime: RuntimeConfig;
};

export type PublicProviderSummary = {
  name: LlmProvider;
  configured: boolean;
  enabled: boolean;
  baseUrl: string;
  model: string;
};

export type PublicConfigSummary = {
  defaultProvider: LlmProvider;
  defaultModel: string;
  timeoutMs: number;
  maxRetries: number;
  networkMode: NetworkMode;
  sandbox: {
    virtualRoot: string;
    allowedWorkspaces: string[];
    allowedCommands: string[];
    execTimeoutMs: number;
    maxOutputBytes: number;
    auditLogEnabled: boolean;
  };
  providers: PublicProviderSummary[];
  modelProfiles: Array<{
    id: string;
    name: string;
    provider: LlmProvider;
    model: string;
    enabled: boolean;
  }>;
  routing: Record<RuntimeRole, string>;
  tools: {
    webSearchEnabled: boolean;
    webFetchEnabled: boolean;
  };
};

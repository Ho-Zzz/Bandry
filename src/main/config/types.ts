export type LlmProvider = "openai" | "deepseek" | "volcengine";

export type NetworkMode = "auto" | "online" | "offline";

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
  enableMiddleware: boolean;
  enableMultiAgent: boolean;
  enableMemory: boolean;
  enableMCP: boolean;
}>;

export type ConfigLayer = {
  llm?: LlmLayerConfig;
  sandbox?: SandboxLayerConfig;
  providers?: Partial<Record<LlmProvider | "bytedance", ProviderLayerConfig>>;
  features?: FeaturesLayerConfig;
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
  providers: {
    openai: ProviderConfig;
    deepseek: ProviderConfig;
    volcengine: ProviderConfig;
  };
  features: {
    enableMiddleware: boolean;
    enableMultiAgent: boolean;
    enableMemory: boolean;
    enableMCP: boolean;
  };
  paths: {
    projectConfigPath: string;
    userConfigPath: string;
    auditLogPath: string;
    sandboxAuditLogPath: string;
    workspaceDir: string;
    databasePath: string;
    traceDir: string;
    resourcesDir: string;
  };
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
};

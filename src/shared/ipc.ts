import type { ModelProvider } from "./model-providers";

export type { ModelProvider } from "./model-providers";
export type ChatRole = "system" | "user" | "assistant";

export type ChatHistoryMessage = {
  role: ChatRole;
  content: string;
};

export type ChatSendInput = {
  requestId?: string;
  message: string;
  history: ChatHistoryMessage[];
  modelProfileId?: string;
};

export type ChatSendResult = {
  reply: string;
  provider: ModelProvider;
  model: string;
  latencyMs: number;
};

export type ChatCancelInput = {
  requestId: string;
};

export type ChatCancelResult = {
  requestId: string;
  cancelled: boolean;
};

export type ChatUpdateStage = "planning" | "tool" | "model" | "final" | "error";

export type ChatUpdateEvent = {
  requestId: string;
  stage: ChatUpdateStage;
  message: string;
  timestamp: number;
};

export type ChatDeltaEvent = {
  requestId: string;
  delta: string;
  timestamp: number;
};

export type TaskStatus = "queued" | "running" | "completed" | "failed";

export type TaskStartInput = {
  prompt: string;
  files: string[];
  useModel?: boolean;
};

export type TaskStartResult = {
  taskId: string;
};

export type TaskUpdateEvent = {
  taskId: string;
  status: TaskStatus;
  progress: number;
  message: string;
  updatedAt: number;
};

export type PingResult = {
  ok: boolean;
  timestamp: number;
};

export type RuntimeProviderSummary = {
  name: ModelProvider;
  configured: boolean;
  enabled: boolean;
  baseUrl: string;
  model: string;
};

export type RuntimeConfigSummary = {
  defaultProvider: ModelProvider;
  defaultModel: string;
  timeoutMs: number;
  maxRetries: number;
  networkMode: "auto" | "online" | "offline";
  sandbox: {
    virtualRoot: string;
    allowedWorkspaces: string[];
    allowedCommands: string[];
    execTimeoutMs: number;
    maxOutputBytes: number;
    auditLogEnabled: boolean;
  };
  providers: RuntimeProviderSummary[];
  modelProfiles: Array<{
    id: string;
    name: string;
    provider: ModelProvider;
    model: string;
    enabled: boolean;
  }>;
  routing: Record<string, string>;
  tools: {
    webSearchEnabled: boolean;
    webFetchEnabled: boolean;
  };
};

export type CatalogModelCapabilities = {
  toolCall: boolean;
  reasoning: boolean;
  inputModalities: string[];
  outputModalities: string[];
};

export type CatalogModelItem = {
  id: string;
  name: string;
  provider: ModelProvider;
  capabilities: CatalogModelCapabilities;
  contextWindow?: number;
  maxOutputTokens?: number;
};

export type ModelsCatalogProvider = {
  id: ModelProvider;
  name: string;
  models: CatalogModelItem[];
};

export type ModelsCatalogListInput = {
  refresh?: boolean;
};

export type ModelsCatalogListResult = {
  sourceType: "http" | "file";
  sourceLocation: string;
  fetchedAt: number;
  providers: ModelsCatalogProvider[];
};

export type ConnectedModelResult = {
  profileId: string;
  profileName: string;
  provider: ModelProvider;
  providerName: string;
  model: string;
  enabled: boolean;
  isChatDefault: boolean;
  providerConfigured: boolean;
};

export type ModelsListConnectedResult = {
  chatDefaultProfileId?: string;
  models: ConnectedModelResult[];
};

export type ModelsConnectInput = {
  provider: ModelProvider;
  modelId: string;
  apiKey: string;
  baseUrl?: string;
};

export type ModelsConnectResult = {
  ok: boolean;
  message: string;
  requiresRestart: boolean;
  profile: ConnectedModelResult;
};

export type ModelsSetDefaultInput = {
  profileId: string;
};

export type ModelsRemoveInput = {
  profileId: string;
};

export type ModelsUpdateCredentialInput = {
  provider: ModelProvider;
  apiKey?: string;
  baseUrl?: string;
  orgId?: string;
};

export type ModelsOperationResult = {
  ok: boolean;
  message: string;
  requiresRestart: boolean;
};

export type SettingsRuntimeRole =
  | "chat.default"
  | "lead.planner"
  | "lead.synthesizer"
  | "sub.researcher"
  | "sub.bash_operator"
  | "sub.writer"
  | "memory.fact_extractor";

export type SettingsModelProfile = {
  id: string;
  name: string;
  provider: ModelProvider;
  model: string;
  enabled: boolean;
  temperature?: number;
  maxTokens?: number;
};

export type GlobalSettingsState = {
  providers: Record<
    ModelProvider,
    {
      enabled: boolean;
      apiKey: string;
      baseUrl: string;
      model: string;
      orgId?: string;
    }
  >;
  modelProfiles: SettingsModelProfile[];
  routing: Record<SettingsRuntimeRole, string>;
  memory: {
    enableMemory: boolean;
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
  };
  tools: {
    webSearch: {
      enabled: boolean;
      apiKey: string;
      baseUrl: string;
      timeoutMs: number;
      maxResults: number;
    };
    webFetch: {
      enabled: boolean;
      apiKey: string;
      baseUrl: string;
      timeoutMs: number;
    };
  };
};

export type SaveSettingsInput = {
  state: GlobalSettingsState;
};

export type SaveSettingsResult = {
  ok: boolean;
  requiresRestart: boolean;
  message: string;
};

export type SandboxEntry = {
  name: string;
  virtualPath: string;
  type: "file" | "directory" | "other";
};

export type SandboxListDirInput = {
  path: string;
};

export type SandboxListDirResult = {
  path: string;
  entries: SandboxEntry[];
};

export type SandboxReadFileInput = {
  path: string;
  encoding?: "utf8";
};

export type SandboxReadFileResult = {
  path: string;
  content: string;
};

export type SandboxWriteFileInput = {
  path: string;
  content: string;
  createDirs?: boolean;
  overwrite?: boolean;
};

export type SandboxWriteFileResult = {
  path: string;
  bytesWritten: number;
};

export type SandboxExecInput = {
  command: string;
  args?: string[];
  cwd?: string;
  timeoutMs?: number;
};

export type SandboxExecResult = {
  command: string;
  args: string[];
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  timedOut: boolean;
  outputTruncated: boolean;
};

// Conversation types
export type ConversationInput = {
  title?: string;
  model_profile_id?: string;
};

export type ConversationResult = {
  id: string;
  title?: string;
  model_profile_id?: string;
  created_at: number;
  updated_at: number;
};

// Message types
export type MessageInput = {
  conversation_id: string;
  role: ChatRole;
  content: string;
  status?: "pending" | "completed" | "error";
  trace?: string;
};

export type MessageResult = {
  id: string;
  conversation_id: string;
  role: ChatRole;
  content: string;
  status: "pending" | "completed" | "error";
  trace?: string;
  created_at: number;
};

export type MessageUpdateInput = {
  content?: string;
  status?: "pending" | "completed" | "error";
  trace?: string;
};

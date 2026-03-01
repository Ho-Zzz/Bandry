import type { ModelProvider } from "./model-providers";

export type { ModelProvider } from "./model-providers";
export type ChatRole = "system" | "user" | "assistant";

export type ChatHistoryMessage = {
  role: ChatRole;
  content: string;
};

/**
 * Chat mode determines the agent's behavior and capabilities.
 * - default: Fast response with single-step tool calls
 * - thinking: Extended thinking with deep reasoning (uses thinking model)
 * - subagents: Multi-agent collaboration with DAG scheduling, todolist, and task tools
 */
export type ChatMode = "default" | "thinking" | "subagents";

export type ChatSendInput = {
  requestId?: string;
  conversationId?: string;
  message: string;
  history: ChatHistoryMessage[];
  modelProfileId?: string;
  /** Chat mode - defaults to 'default' if not specified */
  mode?: ChatMode;
};

export type ChatSendResult = {
  reply: string;
  provider: ModelProvider;
  model: string;
  latencyMs: number;
  workspacePath?: string;
};

export type ChatCancelInput = {
  requestId: string;
};

export type ChatCancelResult = {
  requestId: string;
  cancelled: boolean;
};

export type ChatUpdateStage = "planning" | "tool" | "model" | "final" | "error" | "clarification" | "subagent";

export type ChatClarificationOption = {
  label: string;
  value: string;
  recommended?: boolean;
};

export type ChatClarificationPayload = {
  question: string;
  options: ChatClarificationOption[];
};

/**
 * Sub-agent execution progress info for subagents mode
 */
export type SubagentProgressPayload = {
  taskId: string;
  agentType: "general-purpose" | "researcher" | "bash" | "writer";
  status: "running" | "completed" | "failed";
  progress?: string;
};

export type ChatUpdatePayload = {
  clarification?: ChatClarificationPayload;
  subagent?: SubagentProgressPayload;
  workspacePath?: string;
};

export type ChatUpdateEvent = {
  requestId: string;
  stage: ChatUpdateStage;
  message: string;
  timestamp: number;
  payload?: ChatUpdatePayload;
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
  isEmbeddingModel: boolean;
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
      embeddingModel: string;
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
      vlmProfileId: string;
      embeddingProfileId: string;
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
    githubSearch: {
      enabled: boolean;
      apiKey: string;
      baseUrl: string;
      timeoutMs: number;
      maxResults: number;
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
  workspacePath?: string;
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
  workspace_path?: string;
};

export type ConversationResult = {
  id: string;
  title?: string;
  model_profile_id?: string;
  workspace_path?: string;
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

// Memory types

export type MemorySearchInput = {
  query: string;
  targetUri?: string;
  limit?: number;
};

export type MemorySearchResultItem = {
  uri: string;
  abstract?: string;
  score?: number;
  category?: string;
  matchReason?: string;
};

export type MemorySearchResult = {
  items: MemorySearchResultItem[];
  total: number;
};

export type MemoryAddResourceInput = {
  path: string;
};

export type MemoryAddResourceResult = {
  rootUri: string;
};

export type MemoryListResourcesInput = {
  uri: string;
};

export type MemoryListResourceEntry = {
  name: string;
  uri: string;
  type: "file" | "directory";
};

export type MemoryListResourcesResult = {
  entries: MemoryListResourceEntry[];
};

export type MemoryStatusResult = {
  enabled: boolean;
  running: boolean;
  url?: string;
  error?: string;
};

// Soul types
export type SoulState = {
  soulContent: string;
  identityContent: string;
};

export type SoulUpdateInput = {
  soulContent?: string;
  identityContent?: string;
};

export type SoulOperationResult = {
  ok: boolean;
  message: string;
};

export type SoulInterviewInput = {
  history: { role: "user" | "assistant"; content: string }[];
};

export type SoulInterviewResult = {
  reply: string;
  done: boolean;
};

export type SoulInterviewSummarizeInput = {
  history: { role: "user" | "assistant"; content: string }[];
};

export type SoulInterviewSummarizeResult = {
  soulContent: string;
  identityContent: string;
};

// Skill types
export type SkillItem = {
  name: string;
  description: string;
  tags: string[];
  content: string;
  isBundled: boolean;
  enabled: boolean;
};

export type SkillCreateInput = {
  name: string;
  description: string;
  tags: string[];
  content: string;
};

export type SkillUpdateInput = {
  description?: string;
  tags?: string[];
  content?: string;
};

export type SkillOperationResult = {
  ok: boolean;
  message: string;
};

export type SkillToggleInput = {
  name: string;
  enabled: boolean;
};

// Channel types
export type ChannelStatusEvent = {
  channelId: string;
  status: "stopped" | "starting" | "running" | "error";
  message?: string;
  timestamp: number;
};

export type ModelProvider = "openai" | "deepseek" | "volcengine";
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

// V2 Chat types (middleware-based)
export type ChatV2SendInput = {
  requestId?: string;
  message: string;
  history: ChatHistoryMessage[];
  enableMiddleware?: boolean;
};

export type ChatV2SendResult = {
  reply: string;
  provider: ModelProvider;
  model: string;
  latencyMs: number;
  middlewareUsed: string[];
  workspacePath?: string;
};

// Multi-Agent types
export type ChatMultiAgentSendInput = {
  requestId?: string;
  message: string;
  history: ChatHistoryMessage[];
};

export type ChatMultiAgentSendResult = {
  reply: string;
  provider: ModelProvider;
  model: string;
  latencyMs: number;
  workspacePath: string;
  tasksExecuted: number;
  plan: {
    tasks: Array<{
      subTaskId: string;
      agentRole: string;
      status: string;
    }>;
  };
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

// Employee & Provider types
export type AgentType = "planner" | "generalist" | "specialist" | "executor";

export type ProviderInput = {
  provider_name: string;
  api_key: string;
  base_url?: string;
  is_active?: boolean;
};

export type ProviderResult = {
  id: string;
  provider_name: string;
  api_key: string;
  base_url?: string;
  is_active: boolean;
  created_at: number;
  updated_at: number;
};

export type EmployeeInput = {
  name: string;
  avatar?: string;
  type: AgentType;
  provider_id: string;
  model_id: string;
  system_prompt?: string;
  mcp_tools?: string[];
  override_params?: {
    temperature?: number;
    max_tokens?: number;
  };
};

export type EmployeeResult = {
  id: string;
  name: string;
  avatar?: string;
  type: AgentType;
  provider_id: string;
  model_id: string;
  system_prompt?: string;
  mcp_tools: string[];
  override_params?: {
    temperature?: number;
    max_tokens?: number;
  };
  created_at: number;
  updated_at: number;
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

// HITL (Human-in-the-Loop) types
export type RiskLevel = "low" | "medium" | "high";

export type HITLApprovalRequest = {
  taskId: string;
  operation: string;
  risk: RiskLevel;
  details: string;
  toolCalls?: Array<{
    name: string;
    args: unknown;
  }>;
};

export type HITLApprovalResponse = {
  taskId: string;
  approved: boolean;
  reason?: string;
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

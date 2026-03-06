import type {
  ChatCancelInput,
  ChatCancelResult,
  ChatSendInput,
  ChatSendResult,
  ChatDeltaEvent,
  ChatUpdateEvent,
  ConversationInput,
  ConversationResult,
  ConversationTokenStatsInput,
  ConversationTokenStatsResult,
  GlobalTokenStatsResult,
  MemoryAddResourceInput,
  MemoryAddResourceResult,
  MemoryDeleteResourceInput,
  MemoryDeleteResourceResult,
  MemoryListResourcesInput,
  MemoryListResourcesResult,
  MemoryReadResourceInput,
  MemoryReadResourceResult,
  MemorySearchInput,
  MemorySearchResult,
  MemoryStatusResult,
  ReadFileBase64Input,
  ReadFileBase64Result,
  ModelsCatalogListInput,
  ModelsCatalogListResult,
  ModelsConnectInput,
  ModelsConnectResult,
  ModelsListConnectedResult,
  ModelsOperationResult,
  ModelsRemoveInput,
  ModelsSetDefaultInput,
  ModelsUpdateCredentialInput,
  GlobalSettingsState,
  MessageInput,
  MessageResult,
  MessageUpdateInput,
  PingResult,
  RuntimeConfigSummary,
  ConfigStorageInfoResult,
  OpenConfigDirResult,
  SaveSettingsInput,
  SaveSettingsResult,
  SandboxExecInput,
  SandboxExecResult,
  SandboxListDirInput,
  SandboxListDirResult,
  SandboxReadFileInput,
  SandboxReadFileResult,
  SandboxWriteFileInput,
  SandboxWriteFileResult,
  TaskStartInput,
  TaskStartResult,
  TaskUpdateEvent,
  SoulState,
  SoulUpdateInput,
  SoulOperationResult,
  SoulInterviewInput,
  SoulInterviewResult,
  SoulInterviewSummarizeInput,
  SoulInterviewSummarizeResult,
  SkillItem,
  SkillCreateInput,
  SkillUpdateInput,
  SkillOperationResult,
  SkillToggleInput,
  UserFilesCreateDirInput,
  UserFilesCreateDirResult,
  UserFilesSaveInput,
  UserFilesSaveResult,
  UserFilesListInput,
  UserFilesListResult,
  UserFilesReadInput,
  UserFilesReadResult,
  UserFilesDeleteInput,
  UserFilesDeleteResult,
  UserFilesRenameInput,
  UserFilesRenameResult,
  UserFilesSaveConversationInput,
  UserFilesSaveConversationResult
} from "../../shared/ipc";

declare global {
  interface Window {
    api: {
      // Core
      ping: () => Promise<PingResult>;
      getConfigSummary: () => Promise<RuntimeConfigSummary>;
      getConfigStorageInfo: () => Promise<ConfigStorageInfoResult>;
      openConfigDir: () => Promise<OpenConfigDirResult>;
      getSettingsState: () => Promise<GlobalSettingsState>;
      saveSettingsState: (input: SaveSettingsInput) => Promise<SaveSettingsResult>;
      modelsCatalogList: (input?: ModelsCatalogListInput) => Promise<ModelsCatalogListResult>;
      modelsConnect: (input: ModelsConnectInput) => Promise<ModelsConnectResult>;
      modelsListConnected: () => Promise<ModelsListConnectedResult>;
      modelsSetChatDefault: (input: ModelsSetDefaultInput) => Promise<ModelsOperationResult>;
      modelsRemove: (input: ModelsRemoveInput) => Promise<ModelsOperationResult>;
      modelsUpdateProviderCredential: (input: ModelsUpdateCredentialInput) => Promise<ModelsOperationResult>;

      // Chat APIs
      chatSend: (input: ChatSendInput) => Promise<ChatSendResult>;
      chatCancel: (input: ChatCancelInput) => Promise<ChatCancelResult>;

      // Task Management
      startTask: (input: TaskStartInput) => Promise<TaskStartResult>;

      // Sandbox Operations
      sandboxListDir: (input: SandboxListDirInput) => Promise<SandboxListDirResult>;
      sandboxReadFile: (input: SandboxReadFileInput) => Promise<SandboxReadFileResult>;
      sandboxWriteFile: (input: SandboxWriteFileInput) => Promise<SandboxWriteFileResult>;
      sandboxExec: (input: SandboxExecInput) => Promise<SandboxExecResult>;

      // Conversation Management
      conversationCreate: (input: ConversationInput) => Promise<ConversationResult>;
      conversationList: (limit?: number, offset?: number) => Promise<ConversationResult[]>;
      conversationGet: (id: string) => Promise<ConversationResult | null>;
      conversationUpdate: (id: string, input: Partial<ConversationInput>) => Promise<ConversationResult | null>;
      conversationDelete: (id: string) => Promise<boolean>;
      conversationGetTokenStats: (input: ConversationTokenStatsInput) => Promise<ConversationTokenStatsResult>;
      conversationGetGlobalTokenStats: () => Promise<GlobalTokenStatsResult>;

      // Message Management
      messageCreate: (input: MessageInput) => Promise<MessageResult>;
      messageList: (conversationId: string) => Promise<MessageResult[]>;
      messageUpdate: (id: string, input: MessageUpdateInput) => Promise<MessageResult | null>;
      messageDelete: (id: string) => Promise<boolean>;

      // Dialog API
      dialogOpenFiles: (filters?: { name: string; extensions: string[] }[]) => Promise<string[]>;
      // File API
      readFileBase64: (input: ReadFileBase64Input) => Promise<ReadFileBase64Result>;

      // Memory API
      memoryStatus: () => Promise<MemoryStatusResult>;
      memorySearch: (input: MemorySearchInput) => Promise<MemorySearchResult>;
      memoryAddResource: (input: MemoryAddResourceInput) => Promise<MemoryAddResourceResult>;
      memoryDeleteResource: (input: MemoryDeleteResourceInput) => Promise<MemoryDeleteResourceResult>;
      memoryListResources: (input: MemoryListResourcesInput) => Promise<MemoryListResourcesResult>;
      memoryReadResource: (input: MemoryReadResourceInput) => Promise<MemoryReadResourceResult>;

      // Event Listeners
      onChatUpdate: (listener: (update: ChatUpdateEvent) => void) => () => void;
      onChatDelta: (listener: (update: ChatDeltaEvent) => void) => () => void;
      onConversationUpdate: (listener: (update: ConversationResult) => void) => () => void;
      onTaskUpdate: (listener: (update: TaskUpdateEvent) => void) => () => void;

      // Soul API
      soulGet: () => Promise<SoulState>;
      soulUpdate: (input: SoulUpdateInput) => Promise<SoulOperationResult>;
      soulReset: () => Promise<SoulOperationResult>;
      soulInterview: (input: SoulInterviewInput) => Promise<SoulInterviewResult>;
      soulInterviewSummarize: (input: SoulInterviewSummarizeInput) => Promise<SoulInterviewSummarizeResult>;

      // Skills API
      skillsList: () => Promise<SkillItem[]>;
      skillsCreate: (input: SkillCreateInput) => Promise<SkillOperationResult>;
      skillsUpdate: (name: string, input: SkillUpdateInput) => Promise<SkillOperationResult>;
      skillsDelete: (name: string) => Promise<SkillOperationResult>;
      skillsToggle: (input: SkillToggleInput) => Promise<SkillOperationResult>;

      // User Files API
      userFilesCreateDir: (input: UserFilesCreateDirInput) => Promise<UserFilesCreateDirResult>;
      userFilesSave: (input: UserFilesSaveInput) => Promise<UserFilesSaveResult>;
      userFilesList: (input: UserFilesListInput) => Promise<UserFilesListResult>;
      userFilesRead: (input: UserFilesReadInput) => Promise<UserFilesReadResult>;
      userFilesDelete: (input: UserFilesDeleteInput) => Promise<UserFilesDeleteResult>;
      userFilesRename: (input: UserFilesRenameInput) => Promise<UserFilesRenameResult>;
      userFilesSaveConversation: (input: UserFilesSaveConversationInput) => Promise<UserFilesSaveConversationResult>;
    };
  }
}

export {};

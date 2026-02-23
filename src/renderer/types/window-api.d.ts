import type {
  ChatCancelInput,
  ChatCancelResult,
  ChatSendInput,
  ChatSendResult,
  ChatDeltaEvent,
  ChatUpdateEvent,
  ConversationInput,
  ConversationResult,
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
  TaskUpdateEvent
} from "../../shared/ipc";

declare global {
  interface Window {
    api: {
      // Core
      ping: () => Promise<PingResult>;
      getConfigSummary: () => Promise<RuntimeConfigSummary>;
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

      // Message Management
      messageCreate: (input: MessageInput) => Promise<MessageResult>;
      messageList: (conversationId: string) => Promise<MessageResult[]>;
      messageUpdate: (id: string, input: MessageUpdateInput) => Promise<MessageResult | null>;
      messageDelete: (id: string) => Promise<boolean>;

      // Event Listeners
      onChatUpdate: (listener: (update: ChatUpdateEvent) => void) => () => void;
      onChatDelta: (listener: (update: ChatDeltaEvent) => void) => () => void;
      onTaskUpdate: (listener: (update: TaskUpdateEvent) => void) => () => void;
    };
  }
}

export {};

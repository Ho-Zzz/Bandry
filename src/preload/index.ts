import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  ChatCancelInput,
  ChatCancelResult,
  ChatSendInput,
  ChatSendResult,
  ChatDeltaEvent,
  ChatUpdateEvent,
  ConversationInput,
  ConversationResult,
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
  MessageInput,
  MessageResult,
  MessageUpdateInput,
  PingResult,
  GlobalSettingsState,
  ModelsCatalogListInput,
  ModelsCatalogListResult,
  ModelsConnectInput,
  ModelsConnectResult,
  ModelsListConnectedResult,
  ModelsOperationResult,
  ModelsRemoveInput,
  ModelsSetDefaultInput,
  ModelsUpdateCredentialInput,
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
  SkillToggleInput
} from "../shared/ipc";

const api = {
  ping: (): Promise<PingResult> => ipcRenderer.invoke("app:ping"),
  chatSend: (input: ChatSendInput): Promise<ChatSendResult> => ipcRenderer.invoke("chat:send", input),
  chatCancel: (input: ChatCancelInput): Promise<ChatCancelResult> => ipcRenderer.invoke("chat:cancel", input),
  startTask: (input: TaskStartInput): Promise<TaskStartResult> => ipcRenderer.invoke("task:start", input),
  getConfigSummary: (): Promise<RuntimeConfigSummary> => ipcRenderer.invoke("config:get-summary"),
  getSettingsState: (): Promise<GlobalSettingsState> => ipcRenderer.invoke("config:get-settings-state"),
  saveSettingsState: (input: SaveSettingsInput): Promise<SaveSettingsResult> =>
    ipcRenderer.invoke("config:save-settings-state", input),
  modelsCatalogList: (input?: ModelsCatalogListInput): Promise<ModelsCatalogListResult> =>
    ipcRenderer.invoke("models:catalog:list", input ?? {}),
  modelsConnect: (input: ModelsConnectInput): Promise<ModelsConnectResult> =>
    ipcRenderer.invoke("models:connect", input),
  modelsListConnected: (): Promise<ModelsListConnectedResult> =>
    ipcRenderer.invoke("models:list-connected"),
  modelsSetChatDefault: (input: ModelsSetDefaultInput): Promise<ModelsOperationResult> =>
    ipcRenderer.invoke("models:set-chat-default", input),
  modelsRemove: (input: ModelsRemoveInput): Promise<ModelsOperationResult> =>
    ipcRenderer.invoke("models:remove", input),
  modelsUpdateProviderCredential: (input: ModelsUpdateCredentialInput): Promise<ModelsOperationResult> =>
    ipcRenderer.invoke("models:update-provider-credential", input),
  sandboxListDir: (input: SandboxListDirInput): Promise<SandboxListDirResult> =>
    ipcRenderer.invoke("sandbox:list-dir", input),
  sandboxReadFile: (input: SandboxReadFileInput): Promise<SandboxReadFileResult> =>
    ipcRenderer.invoke("sandbox:read-file", input),
  sandboxWriteFile: (input: SandboxWriteFileInput): Promise<SandboxWriteFileResult> =>
    ipcRenderer.invoke("sandbox:write-file", input),
  sandboxExec: (input: SandboxExecInput): Promise<SandboxExecResult> => ipcRenderer.invoke("sandbox:exec", input),
  onChatUpdate: (listener: (update: ChatUpdateEvent) => void): (() => void) => {
    const wrappedListener = (_event: IpcRendererEvent, update: ChatUpdateEvent): void => {
      listener(update);
    };

    ipcRenderer.on("chat:update", wrappedListener);

    return () => {
      ipcRenderer.removeListener("chat:update", wrappedListener);
    };
  },
  onChatDelta: (listener: (update: ChatDeltaEvent) => void): (() => void) => {
    const wrappedListener = (_event: IpcRendererEvent, update: ChatDeltaEvent): void => {
      listener(update);
    };

    ipcRenderer.on("chat:delta", wrappedListener);

    return () => {
      ipcRenderer.removeListener("chat:delta", wrappedListener);
    };
  },
  onTaskUpdate: (listener: (update: TaskUpdateEvent) => void): (() => void) => {
    const wrappedListener = (_event: IpcRendererEvent, update: TaskUpdateEvent): void => {
      listener(update);
    };

    ipcRenderer.on("task:update", wrappedListener);

    return () => {
      ipcRenderer.removeListener("task:update", wrappedListener);
    };
  },
  // Dialog API
  dialogOpenFiles: (filters?: { name: string; extensions: string[] }[]): Promise<string[]> =>
    ipcRenderer.invoke("dialog:open-files", filters),
  // File API
  readFileBase64: (input: ReadFileBase64Input): Promise<ReadFileBase64Result> =>
    ipcRenderer.invoke("fs:read-file-base64", input),
  // Memory API
  memoryStatus: (): Promise<MemoryStatusResult> =>
    ipcRenderer.invoke("memory:status"),
  memorySearch: (input: MemorySearchInput): Promise<MemorySearchResult> =>
    ipcRenderer.invoke("memory:search", input),
  memoryAddResource: (input: MemoryAddResourceInput): Promise<MemoryAddResourceResult> =>
    ipcRenderer.invoke("memory:add-resource", input),
  memoryDeleteResource: (input: MemoryDeleteResourceInput): Promise<MemoryDeleteResourceResult> =>
    ipcRenderer.invoke("memory:delete-resource", input),
  memoryListResources: (input: MemoryListResourcesInput): Promise<MemoryListResourcesResult> =>
    ipcRenderer.invoke("memory:list-resources", input),
  memoryReadResource: (input: MemoryReadResourceInput): Promise<MemoryReadResourceResult> =>
    ipcRenderer.invoke("memory:read-resource", input),
  // Conversation API
  conversationCreate: (input: ConversationInput): Promise<ConversationResult> =>
    ipcRenderer.invoke("conversation:create", input),
  conversationList: (limit?: number, offset?: number): Promise<ConversationResult[]> =>
    ipcRenderer.invoke("conversation:list", limit, offset),
  conversationGet: (id: string): Promise<ConversationResult | null> =>
    ipcRenderer.invoke("conversation:get", id),
  conversationUpdate: (id: string, input: Partial<ConversationInput>): Promise<ConversationResult | null> =>
    ipcRenderer.invoke("conversation:update", id, input),
  conversationDelete: (id: string): Promise<boolean> =>
    ipcRenderer.invoke("conversation:delete", id),
  // Message API
  messageCreate: (input: MessageInput): Promise<MessageResult> =>
    ipcRenderer.invoke("message:create", input),
  messageList: (conversationId: string): Promise<MessageResult[]> =>
    ipcRenderer.invoke("message:list", conversationId),
  messageUpdate: (id: string, input: MessageUpdateInput): Promise<MessageResult | null> =>
    ipcRenderer.invoke("message:update", id, input),
  messageDelete: (id: string): Promise<boolean> =>
    ipcRenderer.invoke("message:delete", id),
  // Soul API
  soulGet: (): Promise<SoulState> =>
    ipcRenderer.invoke("soul:get"),
  soulUpdate: (input: SoulUpdateInput): Promise<SoulOperationResult> =>
    ipcRenderer.invoke("soul:update", input),
  soulReset: (): Promise<SoulOperationResult> =>
    ipcRenderer.invoke("soul:reset"),
  soulInterview: (input: SoulInterviewInput): Promise<SoulInterviewResult> =>
    ipcRenderer.invoke("soul:interview", input),
  soulInterviewSummarize: (input: SoulInterviewSummarizeInput): Promise<SoulInterviewSummarizeResult> =>
    ipcRenderer.invoke("soul:interview:summarize", input),
  // Skills API
  skillsList: (): Promise<SkillItem[]> =>
    ipcRenderer.invoke("skills:list"),
  skillsCreate: (input: SkillCreateInput): Promise<SkillOperationResult> =>
    ipcRenderer.invoke("skills:create", input),
  skillsUpdate: (name: string, input: SkillUpdateInput): Promise<SkillOperationResult> =>
    ipcRenderer.invoke("skills:update", name, input),
  skillsDelete: (name: string): Promise<SkillOperationResult> =>
    ipcRenderer.invoke("skills:delete", name),
  skillsToggle: (input: SkillToggleInput): Promise<SkillOperationResult> =>
    ipcRenderer.invoke("skills:toggle", input)
};

contextBridge.exposeInMainWorld("api", api);

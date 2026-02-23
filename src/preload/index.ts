import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  ChatCancelInput,
  ChatCancelResult,
  ChatSendInput,
  ChatSendResult,
  ChatDeltaEvent,
  ChatV2SendInput,
  ChatV2SendResult,
  ChatMultiAgentSendInput,
  ChatMultiAgentSendResult,
  ChatUpdateEvent,
  ConversationInput,
  ConversationResult,
  HITLApprovalRequest,
  HITLApprovalResponse,
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
  TaskUpdateEvent
} from "../shared/ipc";

const api = {
  ping: (): Promise<PingResult> => ipcRenderer.invoke("app:ping"),
  chatSend: (input: ChatSendInput): Promise<ChatSendResult> => ipcRenderer.invoke("chat:send", input),
  chatCancel: (input: ChatCancelInput): Promise<ChatCancelResult> => ipcRenderer.invoke("chat:cancel", input),
  chatV2Send: (input: ChatV2SendInput): Promise<ChatV2SendResult> => ipcRenderer.invoke("chat:v2:send", input),
  chatMultiAgentSend: (input: ChatMultiAgentSendInput): Promise<ChatMultiAgentSendResult> => ipcRenderer.invoke("chat:multi-agent:send", input),
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
  onHITLApprovalRequired: (listener: (request: HITLApprovalRequest) => void): (() => void) => {
    const wrappedListener = (_event: IpcRendererEvent, request: HITLApprovalRequest): void => {
      listener(request);
    };

    ipcRenderer.on("hitl:approval-required", wrappedListener);

    return () => {
      ipcRenderer.removeListener("hitl:approval-required", wrappedListener);
    };
  },
  submitHITLApproval: (response: HITLApprovalResponse): Promise<void> =>
    ipcRenderer.invoke("hitl:submit-approval", response),
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
    ipcRenderer.invoke("message:delete", id)
};

contextBridge.exposeInMainWorld("api", api);

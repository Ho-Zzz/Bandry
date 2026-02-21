import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type {
  ChatSendInput,
  ChatSendResult,
  ChatV2SendInput,
  ChatV2SendResult,
  ChatMultiAgentSendInput,
  ChatMultiAgentSendResult,
  ChatUpdateEvent,
  ConversationInput,
  ConversationResult,
  EmployeeInput,
  EmployeeResult,
  HITLApprovalRequest,
  HITLApprovalResponse,
  MessageInput,
  MessageResult,
  MessageUpdateInput,
  PingResult,
  GlobalSettingsState,
  ProviderInput,
  ProviderResult,
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
  chatV2Send: (input: ChatV2SendInput): Promise<ChatV2SendResult> => ipcRenderer.invoke("chat:v2:send", input),
  chatMultiAgentSend: (input: ChatMultiAgentSendInput): Promise<ChatMultiAgentSendResult> => ipcRenderer.invoke("chat:multi-agent:send", input),
  startTask: (input: TaskStartInput): Promise<TaskStartResult> => ipcRenderer.invoke("task:start", input),
  getConfigSummary: (): Promise<RuntimeConfigSummary> => ipcRenderer.invoke("config:get-summary"),
  getSettingsState: (): Promise<GlobalSettingsState> => ipcRenderer.invoke("config:get-settings-state"),
  saveSettingsState: (input: SaveSettingsInput): Promise<SaveSettingsResult> =>
    ipcRenderer.invoke("config:save-settings-state", input),
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
  providerCreate: (input: ProviderInput): Promise<ProviderResult> =>
    ipcRenderer.invoke("provider:create", input),
  providerList: (): Promise<ProviderResult[]> => ipcRenderer.invoke("provider:list"),
  providerGet: (id: string): Promise<ProviderResult | null> => ipcRenderer.invoke("provider:get", id),
  providerUpdate: (id: string, input: Partial<ProviderInput>): Promise<ProviderResult | null> =>
    ipcRenderer.invoke("provider:update", id, input),
  providerDelete: (id: string): Promise<boolean> => ipcRenderer.invoke("provider:delete", id),
  employeeCreate: (input: EmployeeInput): Promise<EmployeeResult> =>
    ipcRenderer.invoke("employee:create", input),
  employeeList: (providerId?: string): Promise<EmployeeResult[]> =>
    ipcRenderer.invoke("employee:list", providerId),
  employeeGet: (id: string): Promise<EmployeeResult | null> => ipcRenderer.invoke("employee:get", id),
  employeeUpdate: (id: string, input: Partial<EmployeeInput>): Promise<EmployeeResult | null> =>
    ipcRenderer.invoke("employee:update", id, input),
  employeeDelete: (id: string): Promise<boolean> => ipcRenderer.invoke("employee:delete", id),
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

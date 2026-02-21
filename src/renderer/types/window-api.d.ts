import type {
  ChatSendInput,
  ChatSendResult,
  ChatUpdateEvent,
  ChatV2SendInput,
  ChatV2SendResult,
  ChatMultiAgentSendInput,
  ChatMultiAgentSendResult,
  GlobalSettingsState,
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
  TaskUpdateEvent,
  ProviderInput,
  ProviderResult,
  EmployeeInput,
  EmployeeResult,
  HITLApprovalRequest,
  HITLApprovalResponse
} from "../../shared/ipc";

declare global {
  interface Window {
    api: {
      // Core
      ping: () => Promise<PingResult>;
      getConfigSummary: () => Promise<RuntimeConfigSummary>;
      getSettingsState: () => Promise<GlobalSettingsState>;
      saveSettingsState: (input: SaveSettingsInput) => Promise<SaveSettingsResult>;

      // Chat APIs
      chatSend: (input: ChatSendInput) => Promise<ChatSendResult>;
      chatV2Send: (input: ChatV2SendInput) => Promise<ChatV2SendResult>;
      chatMultiAgentSend: (input: ChatMultiAgentSendInput) => Promise<ChatMultiAgentSendResult>;

      // Task Management
      startTask: (input: TaskStartInput) => Promise<TaskStartResult>;

      // Sandbox Operations
      sandboxListDir: (input: SandboxListDirInput) => Promise<SandboxListDirResult>;
      sandboxReadFile: (input: SandboxReadFileInput) => Promise<SandboxReadFileResult>;
      sandboxWriteFile: (input: SandboxWriteFileInput) => Promise<SandboxWriteFileResult>;
      sandboxExec: (input: SandboxExecInput) => Promise<SandboxExecResult>;

      // Provider Management
      providerCreate: (input: ProviderInput) => Promise<ProviderResult>;
      providerList: () => Promise<ProviderResult[]>;
      providerGet: (id: string) => Promise<ProviderResult | null>;
      providerUpdate: (id: string, input: Partial<ProviderInput>) => Promise<ProviderResult>;
      providerDelete: (id: string) => Promise<void>;

      // Employee Management
      employeeCreate: (input: EmployeeInput) => Promise<EmployeeResult>;
      employeeList: () => Promise<EmployeeResult[]>;
      employeeGet: (id: string) => Promise<EmployeeResult | null>;
      employeeUpdate: (id: string, input: Partial<EmployeeInput>) => Promise<EmployeeResult>;
      employeeDelete: (id: string) => Promise<void>;

      // Event Listeners
      onChatUpdate: (listener: (update: ChatUpdateEvent) => void) => () => void;
      onTaskUpdate: (listener: (update: TaskUpdateEvent) => void) => () => void;
      onHITLApprovalRequired: (listener: (request: HITLApprovalRequest) => void) => () => void;
      sendHITLApproval: (response: HITLApprovalResponse) => Promise<void>;
    };
  }
}

export {};

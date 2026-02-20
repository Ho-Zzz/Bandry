import type {
  ChatSendInput,
  ChatSendResult,
  ChatUpdateEvent,
  PingResult,
  RuntimeConfigSummary,
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
      ping: () => Promise<PingResult>;
      chatSend: (input: ChatSendInput) => Promise<ChatSendResult>;
      startTask: (input: TaskStartInput) => Promise<TaskStartResult>;
      getConfigSummary: () => Promise<RuntimeConfigSummary>;
      sandboxListDir: (input: SandboxListDirInput) => Promise<SandboxListDirResult>;
      sandboxReadFile: (input: SandboxReadFileInput) => Promise<SandboxReadFileResult>;
      sandboxWriteFile: (input: SandboxWriteFileInput) => Promise<SandboxWriteFileResult>;
      sandboxExec: (input: SandboxExecInput) => Promise<SandboxExecResult>;
      onChatUpdate: (listener: (update: ChatUpdateEvent) => void) => () => void;
      onTaskUpdate: (listener: (update: TaskUpdateEvent) => void) => () => void;
    };
  }
}

export {};

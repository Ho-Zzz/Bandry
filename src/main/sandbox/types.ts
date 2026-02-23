import type {
  SandboxExecInput,
  SandboxExecResult,
  SandboxListDirInput,
  SandboxListDirResult,
  SandboxReadFileInput,
  SandboxReadFileResult,
  SandboxWriteFileInput,
  SandboxWriteFileResult
} from "../../shared/ipc";

export type SandboxOperation = "list_dir" | "read_file" | "write_file" | "exec";

export type SandboxViolationCode =
  | "INVALID_PATH"
  | "PATH_OUTSIDE_VIRTUAL_ROOT"
  | "PATH_OUTSIDE_WORKSPACE"
  | "COMMAND_NOT_ALLOWED"
  | "UNSAFE_ARGUMENT"
  | "FILE_EXISTS"
  | "TIMEOUT"
  | "OUTPUT_LIMIT";

export type SandboxAuditRecord = {
  timestamp: string;
  operation: SandboxOperation;
  success: boolean;
  allowed: boolean;
  durationMs: number;
  details: Record<string, unknown>;
  errorCode?: SandboxViolationCode;
  errorMessage?: string;
};

export type SandboxResolvedPath = {
  virtualPath: string;
  realPath: string;
};

export type SandboxServiceApi = {
  listDir: (input: SandboxListDirInput) => Promise<SandboxListDirResult>;
  readFile: (input: SandboxReadFileInput) => Promise<SandboxReadFileResult>;
  writeFile: (input: SandboxWriteFileInput) => Promise<SandboxWriteFileResult>;
  exec: (input: SandboxExecInput) => Promise<SandboxExecResult>;
};

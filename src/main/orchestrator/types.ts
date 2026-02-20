import type { LlmProvider } from "../config";
import type { GenerateTextResult } from "../models";
import type {
  SandboxExecInput,
  SandboxExecResult,
  SandboxListDirResult,
  SandboxReadFileResult,
  TaskStartInput,
  TaskStatus
} from "../../shared/ipc";

export type OrchestratorTaskInput = TaskStartInput & {
  taskId: string;
};

export type TaskProgressCallback = (status: TaskStatus, progress: number, message: string) => void;

export type PlannedToolCall =
  | { kind: "list_dir"; path: string }
  | { kind: "read_file"; path: string }
  | { kind: "exec"; command: string; args: string[]; cwd?: string };

export type ToolObservation =
  | { kind: "list_dir"; input: { path: string }; output: SandboxListDirResult }
  | { kind: "read_file"; input: { path: string }; output: SandboxReadFileResult }
  | { kind: "exec"; input: SandboxExecInput; output: SandboxExecResult }
  | { kind: "error"; input: Record<string, unknown>; message: string };

export type OrchestratorResult = {
  usedModel: boolean;
  provider?: LlmProvider;
  model?: string;
  modelResult?: GenerateTextResult;
  observations: ToolObservation[];
  outputText: string;
};

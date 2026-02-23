import type { SandboxExecResult, SandboxListDirResult, SandboxReadFileResult } from "../../../shared/ipc";
import { MAX_OBSERVATION_CHARS } from "./chat-constants";
import { truncate } from "./text-utils";

export const formatListDir = (result: SandboxListDirResult): string => {
  const preview = result.entries
    .slice(0, 80)
    .map((entry) => `${entry.type}\t${entry.name}`)
    .join("\n");

  return truncate(preview || "(empty directory)", MAX_OBSERVATION_CHARS);
};

export const formatReadFile = (result: SandboxReadFileResult): string => {
  return truncate(result.content, MAX_OBSERVATION_CHARS);
};

export const formatExec = (result: SandboxExecResult): string => {
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n");
  return truncate(output || `(exit=${result.exitCode})`, MAX_OBSERVATION_CHARS);
};

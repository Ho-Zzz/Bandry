import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../config";
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
import { SandboxViolationError } from "./errors";
import { SandboxPathGuard } from "./path-guard";
import type { SandboxAuditRecord, SandboxOperation, SandboxServiceApi } from "./types";

const READ_PATH_COMMANDS = new Set(["ls", "cat"]);
const WRITE_PATH_COMMANDS = new Set(["mkdir"]);
const API_KEY_PATTERN = /\b(?:sk|tvly|jina)_[A-Za-z0-9_-]{8,}\b/gi;

const hasUnsafeToken = (arg: string): boolean => {
  return arg.includes("&&") || arg.includes("||") || arg.includes("|") || arg.includes(";") || arg.includes("`") || arg.includes("$(");
};

const getEntryType = (isFile: boolean, isDirectory: boolean): "file" | "directory" | "other" => {
  if (isDirectory) {
    return "directory";
  }
  if (isFile) {
    return "file";
  }
  return "other";
};

const createTimeoutError = (timeoutMs: number): SandboxViolationError => {
  return new SandboxViolationError("TIMEOUT", `Command exceeded timeout (${timeoutMs}ms)`, { timeoutMs });
};

const createOutputLimitError = (maxOutputBytes: number): SandboxViolationError => {
  return new SandboxViolationError("OUTPUT_LIMIT", `Command output exceeded limit (${maxOutputBytes} bytes)`, {
    maxOutputBytes
  });
};

export class SandboxService implements SandboxServiceApi {
  private readonly pathGuard: SandboxPathGuard;
  private readonly allowedCommands: Set<string>;
  private workspaceContext: { taskId: string; workspacePath: string } | null = null;

  constructor(private readonly config: AppConfig) {
    this.pathGuard = new SandboxPathGuard(config);
    this.allowedCommands = new Set(config.sandbox.allowedCommands.map((command) => command.toLowerCase()));
  }

  /**
   * Set workspace context for task-specific isolation
   * When set, all operations will be restricted to this workspace
   */
  setWorkspaceContext(taskId: string, workspacePath: string): void {
    this.workspaceContext = { taskId, workspacePath };
  }

  /**
   * Clear workspace context
   */
  clearWorkspaceContext(): void {
    this.workspaceContext = null;
  }

  /**
   * Get current workspace context
   */
  getWorkspaceContext(): { taskId: string; workspacePath: string } | null {
    return this.workspaceContext;
  }

  async listDir(input: SandboxListDirInput): Promise<SandboxListDirResult> {
    return this.withAudit("list_dir", { path: input.path }, async () => {
      const resolved = await this.pathGuard.resolve(input.path, "list");
      const entries = await fs.readdir(resolved.realPath, { withFileTypes: true });
      const mappedEntries = entries
        .map((entry) => ({
          name: entry.name,
          virtualPath: path.posix.join(resolved.virtualPath, entry.name),
          type: getEntryType(entry.isFile(), entry.isDirectory())
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        path: resolved.virtualPath,
        entries: mappedEntries
      };
    });
  }

  async readFile(input: SandboxReadFileInput): Promise<SandboxReadFileResult> {
    return this.withAudit("read_file", { path: input.path }, async () => {
      const encoding = input.encoding ?? "utf8";
      if (encoding !== "utf8") {
        throw new SandboxViolationError("UNSAFE_ARGUMENT", "Only utf8 encoding is allowed", { encoding });
      }

      const resolved = await this.pathGuard.resolve(input.path, "read");
      const content = await fs.readFile(resolved.realPath, "utf8");
      return {
        path: resolved.virtualPath,
        content
      };
    });
  }

  async writeFile(input: SandboxWriteFileInput): Promise<SandboxWriteFileResult> {
    return this.withAudit("write_file", { path: input.path }, async () => {
      const createDirs = input.createDirs !== false;
      const overwrite = input.overwrite === true;
      const resolved = await this.pathGuard.resolve(input.path, "write");

      if (!overwrite) {
        try {
          await fs.access(resolved.realPath);
          throw new SandboxViolationError("FILE_EXISTS", "Target file already exists", { path: resolved.virtualPath });
        } catch (error) {
          if (error instanceof SandboxViolationError) {
            throw error;
          }
          const code = (error as NodeJS.ErrnoException).code;
          if (code && code !== "ENOENT") {
            throw error;
          }
        }
      }

      if (createDirs) {
        await fs.mkdir(path.dirname(resolved.realPath), { recursive: true });
      }

      await fs.writeFile(resolved.realPath, input.content, "utf8");
      return {
        path: resolved.virtualPath,
        bytesWritten: Buffer.byteLength(input.content, "utf8")
      };
    });
  }

  async exec(input: SandboxExecInput): Promise<SandboxExecResult> {
    return this.withAudit(
      "exec",
      { command: input.command, args: input.args ?? [], cwd: input.cwd ?? this.config.sandbox.virtualRoot },
      async () => {
        const { command, args } = await this.resolveCommandInput(input);
        const resolvedCwd = await this.pathGuard.resolve(input.cwd ?? this.config.sandbox.virtualRoot, "cwd");

        const timeoutMs = Math.min(
          this.config.sandbox.execTimeoutMs,
          Math.max(250, Math.floor(input.timeoutMs ?? this.config.sandbox.execTimeoutMs))
        );

        const startedAt = Date.now();
        const result = await this.runCommand(command, args, resolvedCwd.realPath, timeoutMs);

        return {
          command,
          args,
          ...result,
          durationMs: Date.now() - startedAt
        };
      }
    );
  }

  private async resolveCommandInput(input: SandboxExecInput): Promise<{ command: string; args: string[] }> {
    if (typeof input.command !== "string") {
      throw new SandboxViolationError("COMMAND_NOT_ALLOWED", "Command must be a string");
    }

    const rawCommand = input.command.trim();
    if (!rawCommand || /\s/.test(rawCommand)) {
      throw new SandboxViolationError("COMMAND_NOT_ALLOWED", "Command must be a single executable name", {
        command: input.command
      });
    }

    if (rawCommand.includes("/") || rawCommand.includes("\\")) {
      throw new SandboxViolationError("COMMAND_NOT_ALLOWED", "Absolute or relative executable paths are not allowed", {
        command: input.command
      });
    }

    const command = rawCommand.toLowerCase();
    if (!this.allowedCommands.has(command)) {
      throw new SandboxViolationError("COMMAND_NOT_ALLOWED", "Command is not in allowlist", { command });
    }

    const args = (input.args ?? []).map((arg) => {
      if (typeof arg !== "string") {
        throw new SandboxViolationError("UNSAFE_ARGUMENT", "All command arguments must be strings");
      }
      if (hasUnsafeToken(arg)) {
        throw new SandboxViolationError("UNSAFE_ARGUMENT", "Argument contains blocked shell tokens", { arg });
      }
      return arg;
    });

    if (READ_PATH_COMMANDS.has(command) || WRITE_PATH_COMMANDS.has(command)) {
      const mode = READ_PATH_COMMANDS.has(command) ? "read" : "write";
      const resolvedArgs: string[] = [];

      for (const arg of args) {
        if (!arg || arg.startsWith("-")) {
          resolvedArgs.push(arg);
          continue;
        }

        const resolved = await this.pathGuard.resolve(arg, mode);
        resolvedArgs.push(resolved.realPath);
      }

      return { command, args: resolvedArgs };
    }

    return { command, args };
  }

  private async runCommand(
    command: string,
    args: string[],
    cwd: string,
    timeoutMs: number
  ): Promise<Omit<SandboxExecResult, "command" | "args" | "durationMs">> {
    return await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd,
        shell: false,
        env: {
          PATH: process.env.PATH ?? ""
        },
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";
      let outputBytes = 0;
      let timedOut = false;
      let outputTruncated = false;
      const maxOutputBytes = this.config.sandbox.maxOutputBytes;

      const appendChunk = (stream: "stdout" | "stderr", chunk: Buffer): void => {
        if (outputTruncated) {
          return;
        }

        const availableBytes = maxOutputBytes - outputBytes;
        if (availableBytes <= 0) {
          outputTruncated = true;
          child.kill("SIGKILL");
          return;
        }

        if (chunk.byteLength <= availableBytes) {
          const text = chunk.toString("utf8");
          if (stream === "stdout") {
            stdout += text;
          } else {
            stderr += text;
          }
          outputBytes += chunk.byteLength;
          return;
        }

        const truncated = chunk.subarray(0, availableBytes).toString("utf8");
        if (stream === "stdout") {
          stdout += truncated;
        } else {
          stderr += truncated;
        }
        outputBytes = maxOutputBytes;
        outputTruncated = true;
        child.kill("SIGKILL");
      };

      const timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => {
        appendChunk("stdout", chunk);
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        appendChunk("stderr", chunk);
      });

      child.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        if (timedOut) {
          reject(createTimeoutError(timeoutMs));
          return;
        }
        if (outputTruncated) {
          reject(createOutputLimitError(maxOutputBytes));
          return;
        }

        resolve({
          exitCode: code ?? -1,
          stdout,
          stderr,
          timedOut,
          outputTruncated
        });
      });
    });
  }

  private async withAudit<T>(
    operation: SandboxOperation,
    details: Record<string, unknown>,
    execute: () => Promise<T>
  ): Promise<T> {
    const startedAt = Date.now();
    try {
      const result = await execute();
      await this.writeAudit({
        timestamp: new Date().toISOString(),
        operation,
        success: true,
        allowed: true,
        durationMs: Date.now() - startedAt,
        details: this.sanitizeForAudit(details)
      });
      return result;
    } catch (error) {
      const violation = error instanceof SandboxViolationError ? error : null;
      await this.writeAudit({
        timestamp: new Date().toISOString(),
        operation,
        success: false,
        allowed: violation === null ? true : false,
        durationMs: Date.now() - startedAt,
        details: this.sanitizeForAudit(details),
        errorCode: violation?.code,
        errorMessage: error instanceof Error ? error.message : "Sandbox operation failed"
      });
      throw error;
    }
  }

  private async writeAudit(record: SandboxAuditRecord): Promise<void> {
    if (!this.config.sandbox.auditLogEnabled) {
      return;
    }

    const filePath = this.config.paths.sandboxAuditLogPath;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
  }

  private sanitizeForAudit(value: Record<string, unknown>): Record<string, unknown> {
    const sanitizeString = (input: string): string => {
      let output = input;
      for (const workspace of this.config.sandbox.allowedWorkspaces) {
        output = output.replaceAll(workspace, "$WORKSPACE");
      }
      output = output.replace(API_KEY_PATTERN, "key-redacted");
      return output;
    };

    const visit = (node: unknown): unknown => {
      if (typeof node === "string") {
        return sanitizeString(node);
      }
      if (Array.isArray(node)) {
        return node.map((item) => visit(item));
      }
      if (typeof node === "object" && node !== null) {
        const entries = Object.entries(node as Record<string, unknown>).map(([key, item]) => [key, visit(item)]);
        return Object.fromEntries(entries);
      }
      return node;
    };

    return visit(value) as Record<string, unknown>;
  }
}

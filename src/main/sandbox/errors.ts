import type { SandboxViolationCode } from "./types";

export class SandboxViolationError extends Error {
  readonly code: SandboxViolationCode;
  readonly details: Record<string, unknown>;

  constructor(code: SandboxViolationCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "SandboxViolationError";
    this.code = code;
    this.details = details;
  }
}

import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import type { AppConfig } from "../config";
import { SandboxViolationError } from "./errors";
import type { SandboxResolvedPath } from "./types";

type ResolveMode = "read" | "write" | "list" | "cwd";

const isInsideRoot = (target: string, root: string): boolean => {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const isInsideVirtualRoot = (virtualPath: string, virtualRoot: string): boolean => {
  return virtualPath === virtualRoot || virtualPath.startsWith(`${virtualRoot}/`);
};

const canonicalizePath = (inputPath: string): string => {
  const resolved = path.resolve(inputPath);
  try {
    return fsSync.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
};

export class SandboxPathGuard {
  private readonly virtualRoot: string;
  private readonly workspaceRoot: string;
  private readonly allowedRoots: string[];

  constructor(config: AppConfig) {
    this.virtualRoot = config.sandbox.virtualRoot;
    this.workspaceRoot = canonicalizePath(config.paths.workspaceDir);
    this.allowedRoots = config.sandbox.allowedWorkspaces.map((item) => canonicalizePath(item));
  }

  async resolve(inputPath: string, mode: ResolveMode, workspaceOverride?: string): Promise<SandboxResolvedPath> {
    const virtualPath = this.normalizeVirtualPath(inputPath);
    const candidateRealPath = this.virtualToRealPath(virtualPath, workspaceOverride);

    if (mode === "write") {
      await this.assertWritePathAllowed(candidateRealPath);
      return { virtualPath, realPath: candidateRealPath };
    }

    const realPath = await this.resolveExistingRealPath(candidateRealPath);
    this.assertInsideAllowedRoots(realPath);
    return { virtualPath, realPath };
  }

  private normalizeVirtualPath(inputPath: string): string {
    if (typeof inputPath !== "string") {
      throw new SandboxViolationError("INVALID_PATH", "Path must be a string");
    }

    const trimmed = inputPath.trim();
    if (!trimmed) {
      throw new SandboxViolationError("INVALID_PATH", "Path cannot be empty");
    }

    const normalizedSource = trimmed.replaceAll("\\", "/");
    const absoluteVirtual = normalizedSource.startsWith("/")
      ? normalizedSource
      : path.posix.join(this.virtualRoot, normalizedSource);
    const normalizedVirtual = path.posix.normalize(absoluteVirtual);

    if (!isInsideVirtualRoot(normalizedVirtual, this.virtualRoot)) {
      throw new SandboxViolationError("PATH_OUTSIDE_VIRTUAL_ROOT", "Path escapes virtual root", {
        path: inputPath,
        virtualRoot: this.virtualRoot
      });
    }

    return normalizedVirtual;
  }

  private virtualToRealPath(virtualPath: string, workspaceOverride?: string): string {
    const relative = path.posix.relative(this.virtualRoot, virtualPath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new SandboxViolationError("PATH_OUTSIDE_VIRTUAL_ROOT", "Path escapes virtual root", {
        virtualPath
      });
    }

    const effectiveRoot = workspaceOverride
      ? canonicalizePath(workspaceOverride)
      : this.workspaceRoot;
    return path.resolve(effectiveRoot, relative);
  }

  private async resolveExistingRealPath(candidate: string): Promise<string> {
    try {
      return await fs.realpath(candidate);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        throw new SandboxViolationError("INVALID_PATH", "Path does not exist", { path: candidate });
      }
      throw error;
    }
  }

  private async assertWritePathAllowed(candidate: string): Promise<void> {
    const resolvedCandidate = path.resolve(candidate);
    if (!this.isInsideAnyAllowedRoot(resolvedCandidate)) {
      throw new SandboxViolationError("PATH_OUTSIDE_WORKSPACE", "Write path is outside workspace", { path: candidate });
    }

    try {
      const stat = await fs.lstat(resolvedCandidate);
      if (stat.isSymbolicLink()) {
        throw new SandboxViolationError("PATH_OUTSIDE_WORKSPACE", "Writing through symbolic links is blocked", {
          path: candidate
        });
      }

      const realPath = await fs.realpath(resolvedCandidate);
      this.assertInsideAllowedRoots(realPath);
      return;
    } catch (error) {
      const violation = error instanceof SandboxViolationError;
      if (violation) {
        throw error;
      }

      const code = (error as NodeJS.ErrnoException).code;
      if (code && code !== "ENOENT") {
        throw error;
      }
    }

    let parent = path.dirname(resolvedCandidate);
    while (true) {
      try {
        const realParent = await fs.realpath(parent);
        this.assertInsideAllowedRoots(realParent);
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          const next = path.dirname(parent);
          if (next === parent) {
            throw new SandboxViolationError("PATH_OUTSIDE_WORKSPACE", "Cannot resolve a safe parent directory", {
              path: candidate
            });
          }
          parent = next;
          continue;
        }
        throw error;
      }
    }
  }

  private assertInsideAllowedRoots(realPath: string): void {
    if (this.isInsideAnyAllowedRoot(realPath)) {
      return;
    }

    throw new SandboxViolationError("PATH_OUTSIDE_WORKSPACE", "Path is outside authorized workspaces", { path: realPath });
  }

  private isInsideAnyAllowedRoot(realPath: string): boolean {
    return this.allowedRoots.some((root) => isInsideRoot(realPath, root));
  }
}

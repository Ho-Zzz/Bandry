import { accessSync, constants } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export type ResolvedPythonCommand = {
  command: string;
  args: string[];
};

const isExecutable = (filePath: string): boolean => {
  try {
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
};

const findVenvBinary = (searchDirs: string[], name: string): string | null => {
  for (const dir of searchDirs) {
    const candidates = [
      path.join(dir, "python-env", "venv", "bin", name),
      path.join(dir, "python-env", "venv", "Scripts", `${name}.exe`)
    ];
    for (const candidate of candidates) {
      if (isExecutable(candidate)) {
        return candidate;
      }
    }
  }
  return null;
};

const findVenvPython = (searchDirs: string[]): string | null => {
  return findVenvBinary(searchDirs, "python");
};

const isSystemCommandAvailable = (command: string): boolean => {
  try {
    execFileSync("which", [command], { stdio: "pipe", timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
};

/**
 * Resolve the OpenViking server command, checking in order:
 * 1. Explicit config `serverCommand` (if not the default "openviking-server")
 * 2. Bundled venv `openviking-server` binary (project root, then resourcesDir)
 * 3. Bundled venv Python module (`python -m openviking.server.bootstrap`)
 * 4. System-level `openviking-server` command
 */
export const resolveOpenVikingCommand = (
  projectRoot: string,
  resourcesDir: string,
  configServerCommand: string,
  configServerArgs: string[]
): ResolvedPythonCommand => {
  if (configServerCommand !== "openviking-server") {
    return {
      command: configServerCommand,
      args: configServerArgs
    };
  }

  const searchDirs = [projectRoot, resourcesDir];

  const venvCli = findVenvBinary(searchDirs, "openviking-server");
  if (venvCli) {
    return {
      command: venvCli,
      args: configServerArgs
    };
  }

  const venvPython = findVenvPython(searchDirs);
  if (venvPython) {
    return {
      command: venvPython,
      args: ["-m", "openviking.server.bootstrap", ...configServerArgs]
    };
  }

  if (isSystemCommandAvailable("openviking-server")) {
    return {
      command: "openviking-server",
      args: configServerArgs
    };
  }

  return {
    command: configServerCommand,
    args: configServerArgs
  };
};

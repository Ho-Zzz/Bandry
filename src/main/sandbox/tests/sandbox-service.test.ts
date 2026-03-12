import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDefaultConfig } from "../../config/default-config";
import { SandboxViolationError } from "../errors";
import { SandboxService } from "../sandbox-service";

const tempRoots: string[] = [];

type Fixture = {
  rootDir: string;
  workspaceDir: string;
  userHome: string;
  outsideDir: string;
};

const createFixture = async (): Promise<Fixture> => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "bandry-sandbox-"));
  tempRoots.push(rootDir);

  const workspaceDir = path.join(rootDir, "workspace");
  const userHome = path.join(rootDir, "home");
  const outsideDir = path.join(rootDir, "outside");

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(path.join(userHome, ".config", "bandry"), { recursive: true });
  await fs.mkdir(outsideDir, { recursive: true });

  return { rootDir, workspaceDir, userHome, outsideDir };
};

const createService = (fixture: Fixture, timeoutMs: number = 1000): SandboxService => {
  const config = createDefaultConfig({
    paths: {
      projectRoot: fixture.workspaceDir,
      bandryHome: path.join(fixture.userHome, ".bandry"),
      configDir: path.join(fixture.userHome, ".bandry", "config"),
      logsDir: path.join(fixture.userHome, ".bandry", "logs"),
      workspaceDir: fixture.workspaceDir,
      workspacesDir: fixture.workspaceDir,
      resourcesDir: path.join(fixture.userHome, ".bandry", "resources"),
      pluginsDir: path.join(fixture.userHome, ".bandry", "plugins"),
      traceDir: path.join(fixture.userHome, ".bandry", "traces"),
      skillsDir: path.join(fixture.userHome, ".bandry", "skills"),
      soulDir: path.join(fixture.userHome, ".bandry", "soul"),
      projectConfigPath: path.join(fixture.workspaceDir, ".bandry", "config.json"),
      userConfigPath: path.join(fixture.userHome, ".bandry", "config", "config.json"),
      auditLogPath: path.join(fixture.userHome, ".bandry", "logs", "model-audit.log"),
      sandboxAuditLogPath: path.join(fixture.userHome, ".bandry", "logs", "sandbox-audit.log"),
      databasePath: path.join(fixture.userHome, ".bandry", "config", "bandry.db")
    },
    runtime: {
      inheritedEnv: {
        PATH: process.env.PATH ?? ""
      }
    }
  });
  config.sandbox.allowedWorkspaces = [fixture.workspaceDir];
  config.sandbox.allowedCommands = ["ls", "cat", "mkdir", "echo", "node"];
  config.sandbox.execTimeoutMs = timeoutMs;
  config.sandbox.maxOutputBytes = 32768;
  return new SandboxService(config);
};

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0, tempRoots.length).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    })
  );
});

describe("SandboxService", () => {
  it("reads/writes/lists files inside workspace", async () => {
    const fixture = await createFixture();
    const service = createService(fixture);

    await service.writeFile({
      path: "/mnt/workspace/docs/report.txt",
      content: "hello sandbox",
      createDirs: true,
      overwrite: true
    });

    const file = await service.readFile({ path: "/mnt/workspace/docs/report.txt" });
    expect(file.content).toBe("hello sandbox");

    const listed = await service.listDir({ path: "/mnt/workspace/docs" });
    const names = listed.entries.map((entry) => entry.name);
    expect(names).toContain("report.txt");
  });

  it("blocks traversal outside virtual root", async () => {
    const fixture = await createFixture();
    const service = createService(fixture);

    await expect(service.readFile({ path: "../../etc/passwd" })).rejects.toMatchObject({
      code: "PATH_OUTSIDE_VIRTUAL_ROOT"
    });
  });

  it("blocks symbolic-link escape", async () => {
    const fixture = await createFixture();
    const service = createService(fixture);

    await fs.writeFile(path.join(fixture.outsideDir, "secret.txt"), "outside", "utf8");
    await fs.symlink(fixture.outsideDir, path.join(fixture.workspaceDir, "ext"), "dir");

    await expect(service.readFile({ path: "/mnt/workspace/ext/secret.txt" })).rejects.toMatchObject({
      code: "PATH_OUTSIDE_WORKSPACE"
    });
  });

  it("enforces command allowlist and path policies", async () => {
    const fixture = await createFixture();
    const service = createService(fixture);

    await expect(service.exec({ command: "pwd", args: [] })).rejects.toMatchObject({
      code: "COMMAND_NOT_ALLOWED"
    });

    await expect(service.exec({ command: "cat", args: ["/etc/passwd"] })).rejects.toMatchObject({
      code: "PATH_OUTSIDE_VIRTUAL_ROOT"
    });
  });

  it("runs allowed commands in sandboxed cwd", async () => {
    const fixture = await createFixture();
    const service = createService(fixture);

    await fs.writeFile(path.join(fixture.workspaceDir, "alpha.txt"), "A", "utf8");
    const result = await service.exec({
      command: "ls",
      args: ["-1", "/mnt/workspace"],
      cwd: "/mnt/workspace"
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("alpha.txt");
  });

  it("kills long-running commands on timeout", async () => {
    const fixture = await createFixture();
    const service = createService(fixture, 200);

    let error: unknown;
    try {
      await service.exec({
        command: "node",
        args: ["-e", "setTimeout(() => {}, 2000)"]
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(SandboxViolationError);
    expect((error as SandboxViolationError).code).toBe("TIMEOUT");
  });
});

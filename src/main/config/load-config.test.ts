import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadAppConfig } from "./load-config";

const tempRoots: string[] = [];

const createFixture = async (): Promise<{ workspaceDir: string; userHome: string; rootDir: string }> => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "bandry-config-"));
  tempRoots.push(rootDir);

  const workspaceDir = path.join(rootDir, "workspace");
  const userHome = path.join(rootDir, "home");

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(path.join(userHome, ".config", "bandry"), { recursive: true });

  return { workspaceDir, userHome, rootDir };
};

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0, tempRoots.length).map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
    })
  );
});

describe("loadAppConfig", () => {
  it("applies precedence in order env > user > project > default", async () => {
    const fixture = await createFixture();

    await fs.writeFile(
      path.join(fixture.workspaceDir, "config.json"),
      JSON.stringify(
        {
          llm: {
            defaultProvider: "openai",
            defaultModel: "project-model",
            timeoutMs: 20_000
          },
          providers: {
            openai: {
              model: "project-openai-model"
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    await fs.writeFile(
      path.join(fixture.userHome, ".config", "bandry", "config.json"),
      JSON.stringify(
        {
          llm: {
            defaultModel: "user-model",
            timeoutMs: 45_000
          },
          providers: {
            openai: {
              model: "user-openai-model"
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      skipDotenv: true,
      env: {
        LLM_DEFAULT_PROVIDER: "deepseek",
        LLM_DEFAULT_MODEL: "env-model",
        LLM_TIMEOUT_MS: "90000",
        DEEPSEEK_MODEL: "deepseek-from-env",
        DEEPSEEK_API_KEY: "fake-key"
      }
    });

    expect(config.llm.defaultProvider).toBe("deepseek");
    expect(config.llm.defaultModel).toBe("env-model");
    expect(config.llm.timeoutMs).toBe(90_000);
    expect(config.providers.openai.model).toBe("user-openai-model");
    expect(config.providers.deepseek.model).toBe("deepseek-from-env");
    expect(config.sandbox.allowedCommands).toEqual(["ls", "cat", "mkdir", "echo"]);
  });

  it("maps bytedance alias to volcengine", async () => {
    const fixture = await createFixture();

    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      skipDotenv: true,
      env: {
        LLM_DEFAULT_PROVIDER: "bytedance",
        BYTEDANCE_API_KEY: "ark-key",
        BYTEDANCE_BASE_URL: "https://ark.test/api/v3/"
      }
    });

    expect(config.llm.defaultProvider).toBe("volcengine");
    expect(config.providers.volcengine.apiKey).toBe("ark-key");
    expect(config.providers.volcengine.baseUrl).toBe("https://ark.test/api/v3");
  });

  it("falls back default model to provider model when LLM_DEFAULT_MODEL is empty", async () => {
    const fixture = await createFixture();

    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      skipDotenv: true,
      env: {
        LLM_DEFAULT_PROVIDER: "deepseek",
        LLM_DEFAULT_MODEL: "",
        DEEPSEEK_MODEL: "deepseek-coder"
      }
    });

    expect(config.llm.defaultProvider).toBe("deepseek");
    expect(config.llm.defaultModel).toBe("deepseek-coder");
  });

  it("supports sandbox env overrides", async () => {
    const fixture = await createFixture();

    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      skipDotenv: true,
      env: {
        SANDBOX_VIRTUAL_ROOT: "/mnt/custom-root/",
        SANDBOX_ALLOWED_WORKSPACES: `${fixture.workspaceDir},${fixture.userHome}`,
        SANDBOX_ALLOWED_COMMANDS: "ls,cat",
        SANDBOX_EXEC_TIMEOUT_MS: "45000",
        SANDBOX_MAX_OUTPUT_BYTES: "131072",
        SANDBOX_AUDIT_LOG_ENABLED: "false"
      }
    });

    expect(config.sandbox.virtualRoot).toBe("/mnt/custom-root");
    expect(config.sandbox.allowedCommands).toEqual(["ls", "cat"]);
    expect(config.sandbox.allowedWorkspaces).toEqual([fixture.workspaceDir, fixture.userHome]);
    expect(config.sandbox.execTimeoutMs).toBe(45_000);
    expect(config.sandbox.maxOutputBytes).toBe(131_072);
    expect(config.sandbox.auditLogEnabled).toBe(false);
  });
});

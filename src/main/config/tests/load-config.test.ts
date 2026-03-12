import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadAppConfig } from "../load-config";

const tempRoots: string[] = [];

const createFixture = async (): Promise<{ workspaceDir: string; userHome: string; rootDir: string }> => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "bandry-config-"));
  tempRoots.push(rootDir);

  const workspaceDir = path.join(rootDir, "workspace");
  const userHome = path.join(rootDir, "home");

  await fs.mkdir(path.join(workspaceDir, ".bandry"), { recursive: true });
  await fs.mkdir(path.join(userHome, ".bandry", "config"), { recursive: true });
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
  it("uses project+user json layers and ignores provider/tool env overrides", async () => {
    const fixture = await createFixture();
    const projectConfigPath = path.join(fixture.workspaceDir, ".bandry", "config.json");
    const userConfigPath = path.join(fixture.userHome, ".bandry", "config", "config.json");

    await fs.writeFile(
      projectConfigPath,
      JSON.stringify(
        {
          providers: {
            openai: {
              model: "project-openai-model"
            }
          },
          tools: {
            webSearch: {
              enabled: true,
              apiKey: "project-tool-key"
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    await fs.writeFile(
      userConfigPath,
      JSON.stringify(
        {
          llm: {
            defaultProvider: "openai",
            defaultModel: "user-model"
          },
          providers: {
            openai: {
              model: "user-openai-model"
            }
          },
          tools: {
            webSearch: {
              enabled: true,
              apiKey: "user-tool-key",
              baseUrl: "https://api.tavily.com",
              timeoutMs: 15000,
              maxResults: 7
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
      env: {
        ...process.env,
        OPENAI_MODEL: "env-openai-model",
        DEEPSEEK_API_KEY: "env-deepseek-key",
        WEB_SEARCH_ENABLED: "false",
        TAVILY_API_KEY: "env-tool-key"
      }
    });

    expect(config.llm.defaultProvider).toBe("openai");
    expect(config.llm.defaultModel).toBe("user-model");
    expect(config.providers.openai.model).toBe("user-openai-model");
    expect(config.tools.webSearch.enabled).toBe(true);
    expect(config.tools.webSearch.apiKey).toBe("user-tool-key");
    expect(config.providers.deepseek.apiKey).toBe("");
    expect(config.paths.projectConfigPath).toBe(projectConfigPath);
    expect(config.paths.userConfigPath).toBe(userConfigPath);
  });

  it("uses fixed bandry paths and ignores BANDRY_* env path overrides", async () => {
    const fixture = await createFixture();
    const customBandryHome = path.join(fixture.rootDir, "custom-bandry-home");

    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      env: {
        ...process.env,
        BANDRY_HOME: customBandryHome,
        BANDRY_WORKSPACES_DIR: path.join(customBandryHome, "workspaces")
      }
    });

    expect(config.paths.bandryHome).toBe(path.join(fixture.userHome, ".bandry"));
    expect(config.paths.configDir).toBe(path.join(fixture.userHome, ".bandry", "config"));
    expect(config.paths.workspacesDir).toBe(path.join(fixture.userHome, ".bandry", "workspaces"));
    expect(config.paths.databasePath).toBe(path.join(fixture.userHome, ".bandry", "config", "bandry.db"));
  });

  it("loads legacy config file locations for backward compatibility", async () => {
    const fixture = await createFixture();
    const legacyProjectPath = path.join(fixture.workspaceDir, "config.json");
    const legacyUserPath = path.join(fixture.userHome, ".config", "bandry", "config.json");

    await fs.writeFile(
      legacyProjectPath,
      JSON.stringify(
        {
          llm: {
            timeoutMs: 77_000
          }
        },
        null,
        2
      ),
      "utf8"
    );

    await fs.writeFile(
      legacyUserPath,
      JSON.stringify(
        {
          llm: {
            maxRetries: 8
          },
          providers: {
            openai: {
              model: "legacy-user-model"
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
      env: {}
    });

    expect(config.llm.timeoutMs).toBe(77_000);
    expect(config.llm.maxRetries).toBe(8);
    expect(config.providers.openai.model).toBe("legacy-user-model");
  });

  it("keeps VITE_DEV_SERVER_URL as the only env-driven runtime override", async () => {
    const fixture = await createFixture();

    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      env: {
        ...process.env,
        VITE_DEV_SERVER_URL: "http://127.0.0.1:5173",
        PATH: "/usr/local/bin:/usr/bin",
        LLM_DEFAULT_PROVIDER: "deepseek"
      }
    });

    expect(config.runtime.devServerUrl).toBe("http://127.0.0.1:5173");
    expect(config.runtime.inheritedEnv.PATH).toBe("/usr/local/bin:/usr/bin");
    expect(config.llm.defaultProvider).toBe("openai");
  });

  it("migrates legacy openviking serve command to openviking-server", async () => {
    const fixture = await createFixture();
    const userConfigPath = path.join(fixture.userHome, ".bandry", "config", "config.json");

    await fs.writeFile(
      userConfigPath,
      JSON.stringify(
        {
          openviking: {
            serverCommand: "openviking",
            serverArgs: ["serve"]
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
      env: {}
    });

    expect(config.openviking.serverCommand).toBe("openviking-server");
    expect(config.openviking.serverArgs).toEqual([]);
  });
});

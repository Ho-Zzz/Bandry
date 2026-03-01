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
  it("keeps user model/provider settings over env while env can override non-model runtime values", async () => {
    const fixture = await createFixture();
    const projectConfigPath = path.join(fixture.workspaceDir, ".bandry", "config.json");
    const userConfigPath = path.join(fixture.userHome, ".bandry", "config", "config.json");

    await fs.writeFile(
      projectConfigPath,
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
      userConfigPath,
      JSON.stringify(
        {
          llm: {
            defaultProvider: "openai",
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
        OPENAI_MODEL: "openai-from-env",
        WEB_SEARCH_ENABLED: "false",
        TAVILY_API_KEY: "tvly-from-env",
        DEEPSEEK_MODEL: "deepseek-from-env",
        DEEPSEEK_API_KEY: "fake-key"
      }
    });

    expect(config.llm.defaultProvider).toBe("openai");
    expect(config.llm.defaultModel).toBe("user-model");
    expect(config.llm.timeoutMs).toBe(90_000);
    expect(config.providers.openai.model).toBe("user-openai-model");
    expect(config.providers.openai.model).not.toBe("openai-from-env");
    expect(config.providers.deepseek.model).toBe("deepseek-from-env");
    expect(config.tools.webSearch.enabled).toBe(false);
    expect(config.tools.webSearch.apiKey).toBe("tvly-from-env");
    expect(config.paths.projectConfigPath).toBe(projectConfigPath);
    expect(config.paths.userConfigPath).toBe(userConfigPath);
    expect(config.paths.workspaceDir).toBe(path.join(fixture.userHome, ".bandry", "workspaces"));
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
          },
          providers: {
            openai: {
              model: "legacy-project-model"
            }
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
      skipDotenv: true,
      env: {}
    });

    expect(config.llm.timeoutMs).toBe(77_000);
    expect(config.llm.maxRetries).toBe(8);
    expect(config.providers.openai.model).toBe("legacy-user-model");
  });

  it("supports BANDRY path overrides from env", async () => {
    const fixture = await createFixture();
    const customBandryHome = path.join(fixture.rootDir, "custom-bandry-home");
    const customWorkspaceDir = path.join(customBandryHome, "custom-workspaces");

    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      skipDotenv: true,
      env: {
        BANDRY_HOME: customBandryHome,
        BANDRY_WORKSPACES_DIR: customWorkspaceDir
      }
    });

    expect(config.paths.bandryHome).toBe(customBandryHome);
    expect(config.paths.workspacesDir).toBe(customWorkspaceDir);
    expect(config.paths.workspaceDir).toBe(customWorkspaceDir);
    expect(config.sandbox.allowedWorkspaces).toContain(customWorkspaceDir);
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

  it("ignores invalid bytedance base url values from env", async () => {
    const fixture = await createFixture();

    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      skipDotenv: true,
      env: {
        BYTEDANCE_API_KEY: "https://ark.test/api/v3",
        BYTEDANCE_BASE_URL: "endpoint-id-1234"
      }
    });

    expect(config.providers.volcengine.baseUrl).toBe("https://ark.cn-beijing.volces.com/api/v3");
    expect(config.providers.volcengine.apiKey).toBe("endpoint-id-1234");
  });

  it("keeps user volcengine base url when env key/base are swapped", async () => {
    const fixture = await createFixture();
    const userConfigPath = path.join(fixture.userHome, ".bandry", "config", "config.json");

    await fs.writeFile(
      userConfigPath,
      JSON.stringify(
        {
          providers: {
            volcengine: {
              baseUrl: "https://custom.ark.example/api/v3/"
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
        BYTEDANCE_API_KEY: "https://ark.test/api/v3",
        BYTEDANCE_BASE_URL: "endpoint-id-1234"
      }
    });

    expect(config.providers.volcengine.baseUrl).toBe("https://custom.ark.example/api/v3");
    expect(config.providers.volcengine.apiKey).toBe("endpoint-id-1234");
  });

  it("normalizes provider base url when chat/completions suffix is included", async () => {
    const fixture = await createFixture();

    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      skipDotenv: true,
      env: {
        OPENAI_BASE_URL: "https://api.openai.com/v1/chat/completions/"
      }
    });

    expect(config.providers.openai.baseUrl).toBe("https://api.openai.com/v1");
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
    expect(config.sandbox.allowedWorkspaces).toContain(fixture.workspaceDir);
    expect(config.sandbox.allowedWorkspaces).toContain(fixture.userHome);
    expect(config.sandbox.allowedWorkspaces).toContain(config.paths.workspaceDir);
    expect(config.sandbox.execTimeoutMs).toBe(45_000);
    expect(config.sandbox.maxOutputBytes).toBe(131_072);
    expect(config.sandbox.auditLogEnabled).toBe(false);
  });

  it("supports memory and mcp feature flags from env", async () => {
    const fixture = await createFixture();

    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      skipDotenv: true,
      env: {
        ENABLE_MEMORY: "yes",
        ENABLE_MCP: "false"
      }
    });

    expect(config.features.enableMemory).toBe(true);
    expect(config.features.enableMCP).toBe(false);
  });

  it("captures runtime env from unified config loader", async () => {
    const fixture = await createFixture();

    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      skipDotenv: true,
      env: {
        VITE_DEV_SERVER_URL: "http://127.0.0.1:5173",
        PATH: "/usr/local/bin:/usr/bin"
      }
    });

    expect(config.runtime.devServerUrl).toBe("http://127.0.0.1:5173");
    expect(config.runtime.inheritedEnv.PATH).toBe("/usr/local/bin:/usr/bin");
  });

  it("supports openviking env overrides", async () => {
    const fixture = await createFixture();

    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      skipDotenv: true,
      env: {
        OPENVIKING_ENABLED: "true",
        OPENVIKING_HOST: " 127.0.0.1 ",
        OPENVIKING_PORT: "2933",
        OPENVIKING_API_KEY: "test-key",
        OPENVIKING_VLM_PROFILE_ID: "profile_volcengine_default",
        OPENVIKING_EMBEDDING_PROFILE_ID: "profile_openai_default",
        OPENVIKING_SERVER_COMMAND: "python3",
        OPENVIKING_SERVER_ARGS: "-m,openviking.server.bootstrap",
        OPENVIKING_START_TIMEOUT_MS: "25000",
        OPENVIKING_HEALTHCHECK_INTERVAL_MS: "700",
        OPENVIKING_MEMORY_TOP_K: "9",
        OPENVIKING_MEMORY_SCORE_THRESHOLD: "0.62",
        OPENVIKING_COMMIT_DEBOUNCE_MS: "45000",
        OPENVIKING_TARGET_URIS: "viking://user/memories,viking://resources/project-x"
      }
    });

    expect(config.openviking.enabled).toBe(true);
    expect(config.openviking.host).toBe("127.0.0.1");
    expect(config.openviking.port).toBe(2933);
    expect(config.openviking.apiKey).toBe("test-key");
    expect(config.openviking.vlmProfileId).toBe("profile_volcengine_default");
    expect(config.openviking.embeddingProfileId).toBe("profile_openai_default");
    expect(config.openviking.serverCommand).toBe("python3");
    expect(config.openviking.serverArgs).toEqual(["-m", "openviking.server.bootstrap"]);
    expect(config.openviking.startTimeoutMs).toBe(25_000);
    expect(config.openviking.healthcheckIntervalMs).toBe(700);
    expect(config.openviking.memoryTopK).toBe(9);
    expect(config.openviking.memoryScoreThreshold).toBe(0.62);
    expect(config.openviking.commitDebounceMs).toBe(45_000);
    expect(config.openviking.targetUris).toEqual([
      "viking://user/memories",
      "viking://resources/project-x"
    ]);
  });

  it("syncs memory fact extractor routing with lead model routing", async () => {
    const fixture = await createFixture();
    const userConfigPath = path.join(fixture.userHome, ".bandry", "config", "config.json");

    await fs.writeFile(
      userConfigPath,
      JSON.stringify(
        {
          routing: {
            assignments: {
              "lead.planner": "profile_openai_default",
              "lead.synthesizer": "profile_deepseek_default",
              "memory.fact_extractor": "profile_volcengine_default"
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
      env: {}
    });

    expect(config.routing.assignments["lead.synthesizer"]).toBe("profile_deepseek_default");
    expect(config.routing.assignments["memory.fact_extractor"]).toBe("profile_deepseek_default");
  });

  it("supports catalog source overrides from env", async () => {
    const fixture = await createFixture();

    const config = loadAppConfig({
      cwd: fixture.workspaceDir,
      userHome: fixture.userHome,
      skipDotenv: true,
      env: {
        BANDRY_MODELS_SOURCE_TYPE: "file",
        BANDRY_MODELS_SOURCE_LOCATION: "./fixtures/catalog.json",
        BANDRY_MODELS_SOURCE_TIMEOUT_MS: "9000"
      }
    });

    expect(config.catalog.source.type).toBe("file");
    expect(config.catalog.source.location).toBe("./fixtures/catalog.json");
    expect(config.catalog.source.timeoutMs).toBe(9000);
  });

  it("keeps user tools over env tool overrides", async () => {
    const fixture = await createFixture();
    const userConfigPath = path.join(fixture.userHome, ".bandry", "config", "config.json");

    await fs.writeFile(
      userConfigPath,
      JSON.stringify(
        {
          tools: {
            webSearch: {
              enabled: true,
              apiKey: "tvly-from-user",
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
      skipDotenv: true,
      env: {
        WEB_SEARCH_ENABLED: "false",
        TAVILY_API_KEY: "tvly-from-env",
        WEB_SEARCH_MAX_RESULTS: "3"
      }
    });

    expect(config.tools.webSearch.enabled).toBe(true);
    expect(config.tools.webSearch.apiKey).toBe("tvly-from-user");
    expect(config.tools.webSearch.maxResults).toBe(7);
  });
});

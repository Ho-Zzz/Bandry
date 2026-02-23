import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultConfig } from "../config/default-config";
import { ModelService } from "../ai";
import { ModelsFactory } from "./models-factory";

const createConfig = () => {
  const workspaceDir = path.resolve("/tmp/bandry-models-factory");
  const config = createDefaultConfig({
    paths: {
      projectRoot: workspaceDir,
      bandryHome: workspaceDir,
      configDir: path.join(workspaceDir, "config"),
      logsDir: path.join(workspaceDir, "logs"),
      workspaceDir,
      workspacesDir: workspaceDir,
      resourcesDir: path.join(workspaceDir, "resources"),
      pluginsDir: path.join(workspaceDir, "plugins"),
      traceDir: path.join(workspaceDir, "traces"),
      projectConfigPath: path.join(workspaceDir, "config.json"),
      userConfigPath: path.join(workspaceDir, "user-config.json"),
      auditLogPath: path.join(workspaceDir, "model-audit.log"),
      sandboxAuditLogPath: path.join(workspaceDir, "sandbox-audit.log"),
      databasePath: path.join(workspaceDir, "bandry.db"),
      dotenvPath: path.join(workspaceDir, ".env")
    },
    runtime: {
      inheritedEnv: {}
    }
  });

  config.providers.openai.apiKey = "test-openai-key";
  return config;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ModelsFactory", () => {
  it("collects normalized stream events into text result", async () => {
    vi.spyOn(ModelService.prototype, "chat").mockImplementation(async function* () {
      yield { type: "content_delta", delta: "Hello" };
      yield { type: "content_delta", delta: " world" };
      yield {
        type: "finish",
        reason: "stop",
        usage: {
          promptTokens: 10,
          completionTokens: 2,
          totalTokens: 12
        }
      };
    });

    const factory = new ModelsFactory(createConfig());
    const result = await factory.generateText({
      prompt: "Say hello",
      provider: "openai",
      model: "gpt-4.1-mini"
    });

    expect(result.text).toBe("Hello world");
    expect(result.usage).toEqual({
      promptTokens: 10,
      completionTokens: 2,
      totalTokens: 12
    });
  });

  it("forwards deltas in generateTextStream", async () => {
    vi.spyOn(ModelService.prototype, "chat").mockImplementation(async function* () {
      yield { type: "content_delta", delta: "A" };
      yield { type: "content_delta", delta: "B" };
      yield { type: "finish", reason: "stop" };
    });

    const factory = new ModelsFactory(createConfig());
    const deltas: string[] = [];

    const result = await factory.generateTextStream(
      {
        prompt: "letters",
        provider: "openai",
        model: "gpt-4.1-mini"
      },
      (delta) => {
        deltas.push(delta);
      }
    );

    expect(deltas).toEqual(["A", "B"]);
    expect(result.text).toBe("AB");
  });
});

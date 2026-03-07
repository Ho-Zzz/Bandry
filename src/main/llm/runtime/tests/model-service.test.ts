import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "../../../config/default-config";
import { ModelService } from "../model-service";
import { providerRegistry } from "../../providers/_registry";
import type { IProvider } from "../../providers/base.provider";

const createConfig = () => {
  const workspaceDir = path.resolve("/tmp/bandry-ai-service");
  return createDefaultConfig({
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
      skillsDir: path.join(workspaceDir, "skills"),
      soulDir: path.join(workspaceDir, "soul"),
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
};

const collect = async (iterable: AsyncIterable<unknown>): Promise<unknown[]> => {
  const values: unknown[] = [];
  for await (const value of iterable) {
    values.push(value);
  }
  return values;
};

describe("ModelService", () => {
  it("returns error event when provider is unknown", async () => {
    const service = new ModelService(createConfig());

    const events = await collect(
      service.chat({
        modelId: "unknown:model",
        messages: [{ role: "user", content: "hello" }]
      })
    );

    expect(events).toEqual([
      {
        type: "error",
        error: "Provider not found for model: unknown:model"
      }
    ]);
  });

  it("returns error event when provider has no api key", async () => {
    const config = createConfig();
    config.providers.openai.apiKey = "";

    const service = new ModelService(config);
    const events = await collect(
      service.chat({
        modelId: "openai:gpt-4.1-mini",
        messages: [{ role: "user", content: "hello" }]
      })
    );

    expect(events).toEqual([
      {
        type: "error",
        error: "Provider openai is not configured"
      }
    ]);
  });

  it("builds queue and streams events when provider is configured", async () => {
    const config = createConfig();
    config.providers.openai.apiKey = "sk-test-openai";

    const originalProvider = providerRegistry.get("openai");
    const fakeProvider: IProvider = {
      id: "openai",
      async *execute() {
        yield {
          type: "content_delta",
          delta: "hello"
        };
        yield {
          type: "finish",
          reason: "stop"
        };
      }
    };
    providerRegistry.set("openai", fakeProvider);

    try {
      const service = new ModelService(config);
      const events = await collect(
        service.chat({
          modelId: "openai:gpt-4.1-mini",
          messages: [{ role: "user", content: "hello" }]
        })
      );

      expect(events).toEqual([
        {
          type: "content_delta",
          delta: "hello"
        },
        {
          type: "finish",
          reason: "stop"
        }
      ]);
    } finally {
      if (originalProvider) {
        providerRegistry.set("openai", originalProvider);
      } else {
        providerRegistry.delete("openai");
      }
    }
  });
});

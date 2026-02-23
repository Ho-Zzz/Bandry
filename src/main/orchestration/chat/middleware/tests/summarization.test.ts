import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createDefaultConfig } from "../../../../config/default-config";
import { SummarizationMiddleware } from "../summarization";
import type { MiddlewareContext } from "../types";

const createConfig = () => {
  const workspaceDir = path.resolve("/tmp/bandry-summarization-tests");
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

  config.providers.openai.apiKey = "sk-openai-valid-key-1234567890";
  return config;
};

describe("SummarizationMiddleware", () => {
  it("summarizes long message history", async () => {
    const config = createConfig();
    const middleware = new SummarizationMiddleware();

    const modelsFactory = {
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4.1-mini",
        text: "- summary bullet",
        latencyMs: 10
      }))
    };
    const onUpdate = vi.fn();

    const messages = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Message ${i} content ${"x".repeat(600)}`
    }));

    const ctx: MiddlewareContext = {
      sessionId: "session",
      taskId: "task",
      workspacePath: "/tmp/workspace",
      messages,
      tools: [],
      metadata: {},
      state: "before_model",
      runtime: {
        config,
        modelsFactory: modelsFactory as never,
        sandboxService: {} as never,
        onUpdate
      }
    };

    const result = await middleware.beforeModel!(ctx);

    expect(modelsFactory.generateText).toHaveBeenCalledTimes(1);
    expect(result.metadata.summarizationApplied).toBe(true);
    expect(result.messages[0]?.role).toBe("system");
    expect(result.messages[0]?.content).toContain("Conversation summary");
    expect(result.messages.length).toBeLessThan(messages.length);
    expect(onUpdate).toHaveBeenCalledWith(
      "model",
      expect.stringContaining("summarization applied")
    );
  });

  it("reports summarization failure in trace metadata", async () => {
    const config = createConfig();
    const middleware = new SummarizationMiddleware();
    const onUpdate = vi.fn();

    const messages = Array.from({ length: 30 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `Message ${i} content ${"x".repeat(600)}`
    }));

    const ctx: MiddlewareContext = {
      sessionId: "session",
      taskId: "task",
      workspacePath: "/tmp/workspace",
      messages,
      tools: [],
      metadata: {},
      state: "before_model",
      runtime: {
        config,
        modelsFactory: {
          generateText: vi.fn(async () => {
            throw new Error("provider timeout");
          })
        } as never,
        sandboxService: {} as never,
        onUpdate
      }
    };

    const result = await middleware.beforeModel!(ctx);

    expect(result.metadata.summarizationApplied).toBe(false);
    expect(result.metadata.summarizationError).toBe("provider timeout");
    expect(onUpdate).toHaveBeenCalledWith(
      "model",
      expect.stringContaining("summarization failed")
    );
  });
});

import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDefaultConfig } from "../../../../config/default-config";
import { SandboxService } from "../../../../sandbox";
import { buildMiddlewares } from "../loader";

const createConfig = () => {
  const workspaceDir = path.resolve("/tmp/bandry-loader-tests");
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

describe("middleware loader order", () => {
  it("builds middlewares in fixed order and keeps clarification last (default mode)", () => {
    const config = createConfig();
    const sandboxService = new SandboxService(config);

    const middlewares = buildMiddlewares({
      config,
      modelsFactory: {} as never,
      sandboxService,
      conversationStore: undefined
    });

    expect(middlewares.map((item) => item.name)).toEqual([
      "workspace",
      "local_resource",
      "resource_injection",
      "sandbox_binding",
      "dangling_tool_call",
      "summarization",
      "title",
      "memory",
      "resource_curation",
      "clarification"
    ]);
    expect(middlewares[middlewares.length - 1]?.name).toBe("clarification");
  });

  it("includes todolist and subagent_limit in subagents mode", () => {
    const config = createConfig();
    const sandboxService = new SandboxService(config);

    const middlewares = buildMiddlewares({
      config,
      modelsFactory: {} as never,
      sandboxService,
      conversationStore: undefined,
      mode: "subagents"
    });

    expect(middlewares.map((item) => item.name)).toEqual([
      "workspace",
      "local_resource",
      "resource_injection",
      "sandbox_binding",
      "dangling_tool_call",
      "summarization",
      "title",
      "memory",
      "resource_curation",
      "todolist",
      "subagent_limit",
      "clarification"
    ]);
    expect(middlewares[middlewares.length - 1]?.name).toBe("clarification");
  });

  it("uses NoopMemoryMiddleware when no memoryProvider given", () => {
    const config = createConfig();
    const sandboxService = new SandboxService(config);

    const middlewares = buildMiddlewares({
      config,
      modelsFactory: {} as never,
      sandboxService,
      memoryProvider: undefined
    });

    const memory = middlewares.find((item) => item.name === "memory");
    expect(memory).toBeDefined();
    expect(memory!.beforeLLM).toBeUndefined();
  });

  it("uses real MemoryMiddleware when memoryProvider is given", () => {
    const config = createConfig();
    const sandboxService = new SandboxService(config);

    const mockProvider = {
      injectContext: async () => [],
      storeConversation: async () => undefined
    };

    const middlewares = buildMiddlewares({
      config,
      modelsFactory: {} as never,
      sandboxService,
      memoryProvider: mockProvider
    });

    const memory = middlewares.find((item) => item.name === "memory");
    expect(memory).toBeDefined();
    expect(memory!.beforeLLM).toBeDefined();
    expect(memory!.onResponse).toBeDefined();
  });
});

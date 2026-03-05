import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultConfig } from "../../config/default-config";
import { registerIpcHandlers } from "../register-handlers";
import type { ChatSendInput, ChatSendResult } from "../../../shared/ipc";

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown;

const mocked = vi.hoisted(() => {
  const handlers = new Map<string, IpcHandler>();
  const ipcHandle = vi.fn((channel: string, handler: IpcHandler) => {
    handlers.set(channel, handler);
  });

  return {
    handlers,
    ipcHandle
  };
});

vi.mock("electron", () => {
  return {
    ipcMain: {
      handle: mocked.ipcHandle
    },
    BrowserWindow: {
      getFocusedWindow: vi.fn(() => null)
    },
    dialog: {
      showOpenDialog: vi.fn(async () => ({ canceled: true, filePaths: [] }))
    },
    shell: {
      openPath: vi.fn(async () => "")
    }
  };
});

const createTestConfig = () => {
  const root = path.resolve("/tmp/bandry-register-handlers");
  return createDefaultConfig({
    paths: {
      projectRoot: root,
      bandryHome: root,
      configDir: path.join(root, "config"),
      logsDir: path.join(root, "logs"),
      workspaceDir: root,
      workspacesDir: root,
      resourcesDir: path.join(root, "resources"),
      pluginsDir: path.join(root, "plugins"),
      traceDir: path.join(root, "traces"),
      skillsDir: path.join(root, "skills"),
      soulDir: path.join(root, "soul"),
      projectConfigPath: path.join(root, "config.json"),
      userConfigPath: path.join(root, "user-config.json"),
      auditLogPath: path.join(root, "model-audit.log"),
      sandboxAuditLogPath: path.join(root, "sandbox-audit.log"),
      databasePath: path.join(root, "bandry.db")
    },
    runtime: {
      inheritedEnv: {}
    }
  });
};

describe("registerIpcHandlers chat:send", () => {
  beforeEach(() => {
    mocked.handlers.clear();
    mocked.ipcHandle.mockClear();
  });

  it("creates a fresh agent per request", async () => {
    const sendResult: ChatSendResult = {
      reply: "ok",
      provider: "openai",
      model: "gpt-4.1-mini",
      latencyMs: 1
    };
    const sendA = vi.fn(async () => sendResult);
    const sendB = vi.fn(async () => sendResult);
    const createAgent = vi
      .fn()
      .mockReturnValueOnce({
        agent: { send: sendA },
        context: {
          thinkingEnabled: true,
          apiExtras: {},
          warnings: []
        }
      })
      .mockReturnValueOnce({
        agent: { send: sendB },
        context: {
          thinkingEnabled: false,
          apiExtras: {},
          warnings: []
        }
      });

    registerIpcHandlers({
      config: createTestConfig(),
      chatAgentFactory: {
        createAgent
      } as never,
      orchestrator: {} as never,
      sandboxService: {} as never,
      settingsService: {} as never,
      modelOnboardingService: {} as never,
      conversationStore: {} as never,
      userFilesService: {} as never,
      eventBus: {
        broadcastTaskUpdate: vi.fn(),
        broadcastChatUpdate: vi.fn(),
        broadcastChatDelta: vi.fn(),
        broadcastChannelStatus: vi.fn()
      },
      getOpenViking: () => ({
        processManager: null,
        httpClient: null
      }),
      soulService: {} as never,
      skillService: {} as never,
      modelsFactory: {} as never
    });

    const handler = mocked.handlers.get("chat:send");
    expect(handler).toBeDefined();

    const firstInput: ChatSendInput = {
      requestId: "req_1",
      conversationId: "conv_1",
      message: "hello",
      history: [],
      mode: "default",
      thinkingEnabled: false
    };
    const secondInput: ChatSendInput = {
      requestId: "req_2",
      conversationId: "conv_1",
      message: "hello again",
      history: [],
      mode: "thinking",
      thinkingEnabled: true
    };

    await handler?.({}, firstInput);
    await handler?.({}, secondInput);

    expect(createAgent).toHaveBeenCalledTimes(2);
    expect(sendA).toHaveBeenCalledTimes(1);
    expect(sendB).toHaveBeenCalledTimes(1);
    expect(createAgent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        conversationId: "conv_1",
        mode: "default",
        thinkingEnabled: false
      })
    );
    expect(createAgent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        conversationId: "conv_1",
        mode: "thinking",
        thinkingEnabled: true
      })
    );
  });
});

import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { ToolPlanningChatAgent } from "./chat";
import { loadAppConfig, toPublicConfigSummary } from "./config";
import { ModelsFactory } from "./models";
import { OpenVikingMemoryProvider, OpenVikingProcessManager } from "./openviking";
import { LocalOrchestrator } from "./orchestrator";
import { SandboxService } from "./sandbox";
import { SettingsService } from "./settings";
import { MiddlewareChatAgent } from "./chat/middleware-chat-agent";
import { LeadAgent } from "./orchestrator/multi-agent/agents";
import { EmployeeStore, ProviderStore, ConversationStore } from "./storage";
import type {
  ChatCancelInput,
  ChatCancelResult,
  ChatSendInput,
  ChatSendResult,
  ChatV2SendInput,
  ChatV2SendResult,
  ChatMultiAgentSendInput,
  ChatMultiAgentSendResult,
  ChatUpdateEvent,
  ChatDeltaEvent,
  ConversationInput,
  ConversationResult,
  EmployeeInput,
  EmployeeResult,
  GlobalSettingsState,
  HITLApprovalResponse,
  MessageInput,
  MessageResult,
  MessageUpdateInput,
  ProviderInput,
  ProviderResult,
  SandboxExecInput,
  SandboxListDirInput,
  SandboxReadFileInput,
  SandboxWriteFileInput,
  TaskStartInput,
  TaskStartResult,
  TaskStatus,
  TaskUpdateEvent,
  SaveSettingsInput,
  SaveSettingsResult
} from "../shared/ipc";

const config = loadAppConfig();
const devServerUrl = config.runtime.devServerUrl;
const isDev = Boolean(devServerUrl);
const modelsFactory = new ModelsFactory(config);
const sandboxService = new SandboxService(config);
const toolPlanningChatAgent = new ToolPlanningChatAgent(config, modelsFactory, sandboxService);
let middlewareChatAgent: MiddlewareChatAgent;
const leadAgent = new LeadAgent(config, modelsFactory);
const orchestrator = new LocalOrchestrator(config, sandboxService, modelsFactory);
const employeeStore = new EmployeeStore(config.paths.databasePath);
const providerStore = new ProviderStore(config.paths.databasePath);
const conversationStore = new ConversationStore(config.paths.databasePath);
const runningTasks = new Map<string, Promise<void>>();
let openVikingProcessManager: OpenVikingProcessManager | null = null;
let openVikingMemoryProvider: OpenVikingMemoryProvider | null = null;
const settingsService = new SettingsService({ config });
settingsService.ensureRuntimeAssignments();
const activeChatRequests = new Map<string, AbortController>();

const broadcastTaskUpdate = (update: TaskUpdateEvent): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("task:update", update);
  }
};

const broadcastChatUpdate = (update: ChatUpdateEvent): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("chat:update", update);
  }
};

const broadcastChatDelta = (update: ChatDeltaEvent): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("chat:delta", update);
  }
};

const broadcastHITLRequest = (request: import("../shared/ipc").HITLApprovalRequest): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send("hitl:approval-required", request);
  }
};

const pushTaskUpdate = (taskId: string, status: TaskStatus, progress: number, message: string): void => {
  broadcastTaskUpdate({
    taskId,
    status,
    progress,
    message,
    updatedAt: Date.now()
  });
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const runTask = async (taskId: string, input: TaskStartInput): Promise<void> => {
  pushTaskUpdate(taskId, "queued", 0, "Task queued");
  await sleep(120);

  try {
    const result = await orchestrator.runTask(
      {
        taskId,
        ...input
      },
      (status, progress, message) => {
        pushTaskUpdate(taskId, status, progress, message);
      }
    );

    const modelHint = result.usedModel ? `model=${result.provider}/${result.model}` : "model=local";
    const outputPreview = result.outputText.replace(/\s+/g, " ").slice(0, 360);
    pushTaskUpdate(taskId, "completed", 1, `${modelHint} ${outputPreview}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task execution failed";
    pushTaskUpdate(taskId, "failed", 1, message);
  }
};

const initializeOpenViking = async (): Promise<void> => {
  if (!config.features.enableMemory || !config.openviking.enabled) {
    return;
  }

  const manager = new OpenVikingProcessManager(config);
  try {
    const { runtime } = await manager.start();
    console.log(`[OpenViking] started at ${runtime.url}`);

    openVikingProcessManager = manager;
    openVikingMemoryProvider = new OpenVikingMemoryProvider(manager.createHttpClient(), {
      targetUris: config.openviking.targetUris,
      topK: config.openviking.memoryTopK,
      scoreThreshold: config.openviking.memoryScoreThreshold,
      commitDebounceMs: config.openviking.commitDebounceMs
    });
  } catch (error) {
    console.error("[OpenViking] failed to start, memory middleware disabled:", error);
    await manager.stop();
    openVikingProcessManager = null;
    openVikingMemoryProvider = null;
  }
};

const createMainWindow = async (): Promise<BrowserWindow> => {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 720,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  if (isDev && devServerUrl) {
    await window.loadURL(devServerUrl);
  } else {
    await window.loadFile(path.resolve(__dirname, "../dist/index.html"));
  }

  return window;
};

const registerIpcHandlers = (): void => {
  // Set up HITL event broadcasting
  middlewareChatAgent.getEventEmitter().on("hitl:approval-required", (request) => {
    broadcastHITLRequest(request);
  });

  ipcMain.handle("app:ping", async () => {
    return { ok: true, timestamp: Date.now() };
  });

  ipcMain.handle("chat:send", async (_event, input: ChatSendInput): Promise<ChatSendResult> => {
    const requestId = input.requestId?.trim() || `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const controller = new AbortController();
    activeChatRequests.set(requestId, controller);

    try {
      return await toolPlanningChatAgent.send(
        input,
        (stage, message) => {
          broadcastChatUpdate({
            requestId,
            stage,
            message,
            timestamp: Date.now()
          });
        },
        (delta) => {
          broadcastChatDelta({
            requestId,
            delta,
            timestamp: Date.now()
          });
        },
        controller.signal
      );
    } finally {
      activeChatRequests.delete(requestId);
    }
  });

  ipcMain.handle("chat:cancel", async (_event, input: ChatCancelInput): Promise<ChatCancelResult> => {
    const requestId = input.requestId.trim();
    if (!requestId) {
      return {
        requestId: "",
        cancelled: false
      };
    }

    const controller = activeChatRequests.get(requestId);
    if (!controller) {
      return {
        requestId,
        cancelled: false
      };
    }

    controller.abort();
    broadcastChatUpdate({
      requestId,
      stage: "error",
      message: "已主动中断当前生成",
      timestamp: Date.now()
    });

    return {
      requestId,
      cancelled: true
    };
  });

  // Middleware chat handler
  ipcMain.handle("chat:v2:send", async (_event, input: ChatV2SendInput): Promise<ChatV2SendResult> => {
    // Check if middleware is enabled
    const enableMiddleware = input.enableMiddleware ?? config.features.enableMiddleware;

    if (!enableMiddleware) {
      // Fall back to base chat agent
      const requestId = input.requestId?.trim() || `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const result = await toolPlanningChatAgent.send(
        input,
        (stage, message) => {
          broadcastChatUpdate({
            requestId,
            stage,
            message,
            timestamp: Date.now()
          });
        },
        (delta) => {
          broadcastChatDelta({
            requestId,
            delta,
            timestamp: Date.now()
          });
        }
      );

      return {
        ...result,
        middlewareUsed: [],
        workspacePath: undefined
      };
    }

    // Use middleware chat agent
    return await middlewareChatAgent.send(input);
  });

  // Multi-agent handler with DAG scheduling
  ipcMain.handle("chat:multi-agent:send", async (_event, input: ChatMultiAgentSendInput): Promise<ChatMultiAgentSendResult> => {
    const startTime = Date.now();

    // Check if multi-agent is enabled
    if (!config.features.enableMultiAgent) {
      throw new Error("Multi-agent system is not enabled. Set features.enableMultiAgent = true in config.");
    }

    // Generate workspace path
    const taskId = input.requestId || `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const workspacePath = path.join(config.paths.workspaceDir, taskId);

    // Process with Lead Agent
    const result = await leadAgent.processRequest({
      prompt: input.message,
      workspacePath
    });

    const latencyMs = Date.now() - startTime;

    return {
      reply: result.summary,
      provider: config.llm.defaultProvider,
      model: config.llm.defaultModel,
      latencyMs,
      workspacePath,
      tasksExecuted: result.plan.tasks.length,
      plan: {
        tasks: result.plan.tasks.map((task) => ({
          subTaskId: task.subTaskId,
          agentRole: task.agentRole,
          status: result.results.get(task.subTaskId)?.success ? "completed" : "failed"
        }))
      }
    };
  });

  ipcMain.handle("config:get-summary", async () => {
    return toPublicConfigSummary(config);
  });

  ipcMain.handle("config:get-settings-state", async (): Promise<GlobalSettingsState> => {
    return settingsService.getState();
  });

  ipcMain.handle("config:save-settings-state", async (_event, input: SaveSettingsInput): Promise<SaveSettingsResult> => {
    const result = await settingsService.saveState(input);
    return result;
  });

  // Provider IPC handlers
  ipcMain.handle("provider:create", async (_event, input: ProviderInput): Promise<ProviderResult> => {
    return providerStore.createProvider(input);
  });

  ipcMain.handle("provider:list", async (): Promise<ProviderResult[]> => {
    return providerStore.listProviders();
  });

  ipcMain.handle("provider:get", async (_event, id: string): Promise<ProviderResult | null> => {
    return providerStore.getProvider(id);
  });

  ipcMain.handle("provider:update", async (_event, id: string, input: Partial<ProviderInput>): Promise<ProviderResult | null> => {
    return providerStore.updateProvider(id, input);
  });

  ipcMain.handle("provider:delete", async (_event, id: string): Promise<boolean> => {
    return providerStore.deleteProvider(id);
  });

  // Employee IPC handlers
  ipcMain.handle("employee:create", async (_event, input: EmployeeInput): Promise<EmployeeResult> => {
    return employeeStore.createEmployee(input);
  });

  ipcMain.handle("employee:list", async (_event, providerId?: string): Promise<EmployeeResult[]> => {
    return employeeStore.listEmployees(providerId);
  });

  ipcMain.handle("employee:get", async (_event, id: string): Promise<EmployeeResult | null> => {
    return employeeStore.getEmployee(id);
  });

  ipcMain.handle("employee:update", async (_event, id: string, input: Partial<EmployeeInput>): Promise<EmployeeResult | null> => {
    return employeeStore.updateEmployee(id, input);
  });

  ipcMain.handle("employee:delete", async (_event, id: string): Promise<boolean> => {
    return employeeStore.deleteEmployee(id);
  });

  // Conversation IPC handlers
  ipcMain.handle("conversation:create", async (_event, input: ConversationInput): Promise<ConversationResult> => {
    return conversationStore.createConversation(input);
  });

  ipcMain.handle("conversation:list", async (_event, limit?: number, offset?: number): Promise<ConversationResult[]> => {
    return conversationStore.listConversations(limit, offset);
  });

  ipcMain.handle("conversation:get", async (_event, id: string): Promise<ConversationResult | null> => {
    return conversationStore.getConversation(id);
  });

  ipcMain.handle("conversation:update", async (_event, id: string, input: Partial<ConversationInput>): Promise<ConversationResult | null> => {
    return conversationStore.updateConversation(id, input);
  });

  ipcMain.handle("conversation:delete", async (_event, id: string): Promise<boolean> => {
    return conversationStore.deleteConversation(id);
  });

  // Message IPC handlers
  ipcMain.handle("message:create", async (_event, input: MessageInput): Promise<MessageResult> => {
    return conversationStore.createMessage(input);
  });

  ipcMain.handle("message:list", async (_event, conversationId: string): Promise<MessageResult[]> => {
    return conversationStore.listMessages(conversationId);
  });

  ipcMain.handle("message:update", async (_event, id: string, input: MessageUpdateInput): Promise<MessageResult | null> => {
    return conversationStore.updateMessage(id, input);
  });

  ipcMain.handle("message:delete", async (_event, id: string): Promise<boolean> => {
    return conversationStore.deleteMessage(id);
  });

  ipcMain.handle("task:start", async (_event, input: TaskStartInput): Promise<TaskStartResult> => {
    const prompt = input.prompt.trim();
    if (!prompt) {
      throw new Error("prompt is required");
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const taskPromise = runTask(taskId, { ...input, prompt }).finally(() => {
      runningTasks.delete(taskId);
    });
    runningTasks.set(taskId, taskPromise);
    return { taskId };
  });

  ipcMain.handle("sandbox:list-dir", async (_event, input: SandboxListDirInput) => {
    return await sandboxService.listDir(input);
  });

  ipcMain.handle("sandbox:read-file", async (_event, input: SandboxReadFileInput) => {
    return await sandboxService.readFile(input);
  });

  ipcMain.handle("sandbox:write-file", async (_event, input: SandboxWriteFileInput) => {
    return await sandboxService.writeFile(input);
  });

  ipcMain.handle("sandbox:exec", async (_event, input: SandboxExecInput) => {
    return await sandboxService.exec(input);
  });

  // HITL approval response handler
  ipcMain.handle("hitl:submit-approval", async (_event, response: HITLApprovalResponse): Promise<void> => {
    // Emit approval response event
    // This will be picked up by HITLMiddleware
    middlewareChatAgent.submitHITLApproval(response);
  });
};

app.whenReady().then(async () => {
  await initializeOpenViking();
  middlewareChatAgent = new MiddlewareChatAgent(config, toolPlanningChatAgent, openVikingMemoryProvider ?? undefined);
  registerIpcHandlers();
  await createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  runningTasks.clear();
  void openVikingMemoryProvider?.flush();
  void openVikingProcessManager?.stop();

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  void openVikingMemoryProvider?.flush();
  void openVikingProcessManager?.stop();
});

import { ipcMain } from "electron";
import { toPublicConfigSummary, type AppConfig } from "../config";
import { ToolPlanningChatAgent } from "../orchestration/chat";
import { LocalOrchestrator } from "../orchestration/workflow";
import { SandboxService } from "../sandbox";
import { ModelOnboardingService, SettingsService } from "../settings";
import { ConversationStore } from "../persistence/sqlite";
import type {
  ChatCancelInput,
  ChatCancelResult,
  ChatDeltaEvent,
  ChatSendInput,
  ChatSendResult,
  ChatUpdateEvent,
  ConversationInput,
  ConversationResult,
  GlobalSettingsState,
  MessageInput,
  MessageResult,
  MessageUpdateInput,
  ModelsCatalogListInput,
  ModelsCatalogListResult,
  ModelsConnectInput,
  ModelsConnectResult,
  ModelsListConnectedResult,
  ModelsOperationResult,
  ModelsRemoveInput,
  ModelsSetDefaultInput,
  ModelsUpdateCredentialInput,
  SaveSettingsInput,
  SaveSettingsResult,
  SandboxExecInput,
  SandboxListDirInput,
  SandboxReadFileInput,
  SandboxWriteFileInput,
  TaskStartInput,
  TaskStartResult,
  TaskStatus,
  TaskUpdateEvent
} from "../../shared/ipc";
import type { IpcEventBus } from "./event-bus";

type RegisterIpcHandlersInput = {
  config: AppConfig;
  toolPlanningChatAgent: ToolPlanningChatAgent;
  orchestrator: LocalOrchestrator;
  sandboxService: SandboxService;
  settingsService: SettingsService;
  modelOnboardingService: ModelOnboardingService;
  conversationStore: ConversationStore;
  eventBus: IpcEventBus;
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const registerIpcHandlers = (input: RegisterIpcHandlersInput): { clearRunningTasks: () => void } => {
  const runningTasks = new Map<string, Promise<void>>();
  const activeChatRequests = new Map<string, AbortController>();

  const pushTaskUpdate = (taskId: string, status: TaskStatus, progress: number, message: string): void => {
    const update: TaskUpdateEvent = {
      taskId,
      status,
      progress,
      message,
      updatedAt: Date.now()
    };
    input.eventBus.broadcastTaskUpdate(update);
  };

  const runTask = async (taskId: string, taskInput: TaskStartInput): Promise<void> => {
    pushTaskUpdate(taskId, "queued", 0, "Task queued");
    await sleep(120);

    try {
      const result = await input.orchestrator.runTask(
        {
          taskId,
          ...taskInput
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

  ipcMain.handle("app:ping", async () => {
    return { ok: true, timestamp: Date.now() };
  });

  ipcMain.handle("chat:send", async (_event, chatInput: ChatSendInput): Promise<ChatSendResult> => {
    const requestId = chatInput.requestId?.trim() || `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const controller = new AbortController();
    activeChatRequests.set(requestId, controller);

    try {
      return await input.toolPlanningChatAgent.send(
        chatInput,
        (stage, message, payload) => {
          const update: ChatUpdateEvent = {
            requestId,
            stage,
            message,
            timestamp: Date.now(),
            payload
          };
          input.eventBus.broadcastChatUpdate(update);
        },
        (delta) => {
          const update: ChatDeltaEvent = {
            requestId,
            delta,
            timestamp: Date.now()
          };
          input.eventBus.broadcastChatDelta(update);
        },
        controller.signal
      );
    } finally {
      activeChatRequests.delete(requestId);
    }
  });

  ipcMain.handle("chat:cancel", async (_event, cancelInput: ChatCancelInput): Promise<ChatCancelResult> => {
    const requestId = cancelInput.requestId.trim();
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
    input.eventBus.broadcastChatUpdate({
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

  ipcMain.handle("config:get-summary", async () => {
    return toPublicConfigSummary(input.config);
  });

  ipcMain.handle("config:get-settings-state", async (): Promise<GlobalSettingsState> => {
    return input.settingsService.getState();
  });

  ipcMain.handle("config:save-settings-state", async (_event, saveInput: SaveSettingsInput): Promise<SaveSettingsResult> => {
    return await input.settingsService.saveState(saveInput);
  });

  ipcMain.handle(
    "models:catalog:list",
    async (_event, listInput: ModelsCatalogListInput = {}): Promise<ModelsCatalogListResult> => {
      return input.modelOnboardingService.listCatalog(listInput);
    }
  );

  ipcMain.handle("models:connect", async (_event, connectInput: ModelsConnectInput): Promise<ModelsConnectResult> => {
    return input.modelOnboardingService.connect(connectInput);
  });

  ipcMain.handle("models:list-connected", async (): Promise<ModelsListConnectedResult> => {
    return input.modelOnboardingService.listConnected();
  });

  ipcMain.handle("models:set-chat-default", async (_event, setInput: ModelsSetDefaultInput): Promise<ModelsOperationResult> => {
    return input.modelOnboardingService.setChatDefault(setInput);
  });

  ipcMain.handle("models:remove", async (_event, removeInput: ModelsRemoveInput): Promise<ModelsOperationResult> => {
    return input.modelOnboardingService.remove(removeInput);
  });

  ipcMain.handle(
    "models:update-provider-credential",
    async (_event, credentialInput: ModelsUpdateCredentialInput): Promise<ModelsOperationResult> => {
      return input.modelOnboardingService.updateProviderCredential(credentialInput);
    }
  );

  ipcMain.handle("conversation:create", async (_event, conversationInput: ConversationInput = {}): Promise<ConversationResult> => {
    return input.conversationStore.createConversation(conversationInput);
  });

  ipcMain.handle("conversation:list", async (_event, limit?: number, offset?: number): Promise<ConversationResult[]> => {
    return input.conversationStore.listConversations(limit, offset);
  });

  ipcMain.handle("conversation:get", async (_event, id: string): Promise<ConversationResult | null> => {
    return input.conversationStore.getConversation(id);
  });

  ipcMain.handle(
    "conversation:update",
    async (_event, id: string, conversationInput: Partial<ConversationInput>): Promise<ConversationResult | null> => {
      return input.conversationStore.updateConversation(id, conversationInput);
    }
  );

  ipcMain.handle("conversation:delete", async (_event, id: string): Promise<boolean> => {
    return input.conversationStore.deleteConversation(id);
  });

  ipcMain.handle("message:create", async (_event, messageInput: MessageInput): Promise<MessageResult> => {
    return input.conversationStore.createMessage(messageInput);
  });

  ipcMain.handle("message:list", async (_event, conversationId: string): Promise<MessageResult[]> => {
    return input.conversationStore.listMessages(conversationId);
  });

  ipcMain.handle("message:update", async (_event, id: string, messageInput: MessageUpdateInput): Promise<MessageResult | null> => {
    return input.conversationStore.updateMessage(id, messageInput);
  });

  ipcMain.handle("message:delete", async (_event, id: string): Promise<boolean> => {
    return input.conversationStore.deleteMessage(id);
  });

  ipcMain.handle("task:start", async (_event, taskInput: TaskStartInput): Promise<TaskStartResult> => {
    const prompt = taskInput.prompt.trim();
    if (!prompt) {
      throw new Error("prompt is required");
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const taskPromise = runTask(taskId, { ...taskInput, prompt }).finally(() => {
      runningTasks.delete(taskId);
    });
    runningTasks.set(taskId, taskPromise);

    return { taskId };
  });

  ipcMain.handle("sandbox:list-dir", async (_event, listDirInput: SandboxListDirInput) => {
    return await input.sandboxService.listDir(listDirInput);
  });

  ipcMain.handle("sandbox:read-file", async (_event, readFileInput: SandboxReadFileInput) => {
    return await input.sandboxService.readFile(readFileInput);
  });

  ipcMain.handle("sandbox:write-file", async (_event, writeFileInput: SandboxWriteFileInput) => {
    return await input.sandboxService.writeFile(writeFileInput);
  });

  ipcMain.handle("sandbox:exec", async (_event, execInput: SandboxExecInput) => {
    return await input.sandboxService.exec(execInput);
  });

  return {
    clearRunningTasks: (): void => {
      runningTasks.clear();
    }
  };
};

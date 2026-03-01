import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { BrowserWindow, dialog, ipcMain } from "electron";
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
  MemoryAddResourceInput,
  MemoryAddResourceResult,
  MemoryDeleteResourceInput,
  MemoryDeleteResourceResult,
  MemoryListResourcesInput,
  MemoryListResourcesResult,
  MemoryReadResourceInput,
  MemoryReadResourceResult,
  MemorySearchInput,
  MemorySearchResult,
  MemoryStatusResult,
  ReadFileBase64Input,
  ReadFileBase64Result,
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
  TaskUpdateEvent,
  SoulUpdateInput,
  SkillCreateInput,
  SkillUpdateInput,
  SoulInterviewInput,
  SoulInterviewSummarizeInput,
  SkillToggleInput
} from "../../shared/ipc";
import type { OpenVikingHttpClient } from "../memory/openviking/http-client";
import type { OpenVikingProcessManager } from "../memory/openviking/process-manager";
import type { IpcEventBus } from "./event-bus";
import type { SoulService } from "../soul/soul-service";
import type { SkillService } from "../skills/skill-service";
import type { ModelsFactory } from "../llm/runtime";
import { INTERVIEW_SYSTEM_PROMPT, SUMMARIZE_SYSTEM_PROMPT } from "../soul/interview-prompts";
import { resolveRuntimeTarget } from "../llm/runtime/runtime-target";

type RegisterIpcHandlersInput = {
  config: AppConfig;
  toolPlanningChatAgent: ToolPlanningChatAgent;
  orchestrator: LocalOrchestrator;
  sandboxService: SandboxService;
  settingsService: SettingsService;
  modelOnboardingService: ModelOnboardingService;
  conversationStore: ConversationStore;
  eventBus: IpcEventBus;
  getOpenViking: () => {
    processManager: OpenVikingProcessManager | null;
    httpClient: OpenVikingHttpClient | null;
  };
  soulService: SoulService;
  skillService: SkillService;
  modelsFactory: ModelsFactory;
  onSettingsSaved?: () => void;
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
    const result = await input.settingsService.saveState(saveInput);
    if (result.ok) {
      input.onSettingsSaved?.();
    }
    return result;
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

  ipcMain.handle(
    "dialog:open-files",
    async (_event, filters?: { name: string; extensions: string[] }[]): Promise<string[]> => {
      const win = BrowserWindow.getFocusedWindow();
      if (!win) {
        return [];
      }
      const result = await dialog.showOpenDialog(win, {
        properties: ["openFile", "multiSelections"],
        filters: filters ?? [{ name: "All Files", extensions: ["*"] }]
      });
      return result.canceled ? [] : result.filePaths;
    }
  );

  const MIME_MAP: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp"
  };

  ipcMain.handle(
    "fs:read-file-base64",
    async (_event, fileInput: ReadFileBase64Input): Promise<ReadFileBase64Result> => {
      const buffer = await readFile(fileInput.path);
      const ext = extname(fileInput.path).toLowerCase();
      return {
        base64: buffer.toString("base64"),
        mimeType: MIME_MAP[ext] ?? "application/octet-stream"
      };
    }
  );

  ipcMain.handle("memory:status", async (): Promise<MemoryStatusResult> => {
    const ov = input.getOpenViking();
    if (!ov.processManager) {
      return { enabled: false, running: false };
    }
    const runtime = ov.processManager.getRuntime();
    if (!runtime) {
      return { enabled: true, running: false };
    }
    const healthy = ov.httpClient ? await ov.httpClient.health() : false;
    return {
      enabled: true,
      running: healthy,
      url: runtime.url
    };
  });

  ipcMain.handle("memory:search", async (_event, searchInput: MemorySearchInput): Promise<MemorySearchResult> => {
    const ov = input.getOpenViking();
    if (!ov.httpClient) {
      return { items: [], total: 0 };
    }

    const result = await ov.httpClient.search({
      query: searchInput.query,
      targetUri: searchInput.targetUri,
      limit: searchInput.limit
    });

    const merged = [
      ...(result.memories ?? []),
      ...(result.resources ?? []),
      ...(result.skills ?? [])
    ]
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, searchInput.limit ?? 10);

    const items = merged.map((item) => ({
      uri: item.uri,
      abstract: item.abstract,
      score: item.score,
      category: item.context_type || item.category || undefined,
      matchReason: item.match_reason || undefined
    }));

    return { items, total: items.length };
  });

  ipcMain.handle(
    "memory:add-resource",
    async (_event, resourceInput: MemoryAddResourceInput): Promise<MemoryAddResourceResult> => {
      const ov = input.getOpenViking();
      if (!ov.httpClient) {
        throw new Error("OpenViking is not running");
      }
      const result = await ov.httpClient.addResource(resourceInput.path);
      return { rootUri: result.root_uri };
    }
  );

  ipcMain.handle(
    "memory:list-resources",
    async (_event, listInput: MemoryListResourcesInput): Promise<MemoryListResourcesResult> => {
      const ov = input.getOpenViking();
      if (!ov.httpClient) {
        throw new Error("OpenViking is not running");
      }
      const result = await ov.httpClient.ls(listInput.uri);
      return {
        entries: result.map((entry) => {
          const uriStr = entry.uri ?? "";
          const fallbackName = uriStr.split("/").filter(Boolean).pop() ?? uriStr;
          return {
            name: entry.name ?? fallbackName,
            uri: uriStr,
            type: entry.isDir ? ("directory" as const) : ("file" as const)
          };
        })
      };
    }
  );

  ipcMain.handle(
    "memory:delete-resource",
    async (_event, deleteInput: MemoryDeleteResourceInput): Promise<MemoryDeleteResourceResult> => {
      const ov = input.getOpenViking();
      if (!ov.httpClient) {
        throw new Error("OpenViking is not running");
      }
      await ov.httpClient.rm(deleteInput.uri, deleteInput.recursive ?? false);
      return { ok: true };
    }
  );

  ipcMain.handle(
    "memory:read-resource",
    async (_event, readInput: MemoryReadResourceInput): Promise<MemoryReadResourceResult> => {
      const ov = input.getOpenViking();
      if (!ov.httpClient) {
        throw new Error("OpenViking is not running");
      }
      const result = await ov.httpClient.read(readInput.uri);
      return {
        uri: readInput.uri,
        content: typeof result === "string" ? result : (result as Record<string, unknown>).content as string ?? ""
      };
    }
  );

  // Soul API
  ipcMain.handle("soul:get", async () => {
    return input.soulService.get();
  });

  ipcMain.handle("soul:update", async (_event, updateInput: SoulUpdateInput) => {
    return input.soulService.update(updateInput);
  });

  ipcMain.handle("soul:reset", async () => {
    return input.soulService.reset();
  });

  ipcMain.handle("soul:interview", async (_event, interviewInput: SoulInterviewInput) => {
    const target = resolveRuntimeTarget(input.config, "lead.planner");
    const history = interviewInput.history.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content
    }));

    const result = await input.modelsFactory.generateText({
      systemPrompt: INTERVIEW_SYSTEM_PROMPT,
      ...(history.length > 0
        ? { messages: history }
        : { prompt: "Start the interview. Greet the user and ask your first question." }),
      runtimeConfig: target.runtimeConfig,
      model: target.model,
      temperature: 0.8,
      maxTokens: 500
    });

    const done = result.text.includes("[INTERVIEW_COMPLETE]");
    const reply = result.text.replace("[INTERVIEW_COMPLETE]", "").trim();

    return { reply, done };
  });

  ipcMain.handle("soul:interview:summarize", async (_event, summarizeInput: SoulInterviewSummarizeInput) => {
    const target = resolveRuntimeTarget(input.config, "lead.planner");
    const transcript = summarizeInput.history
      .map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content}`)
      .join("\n\n");

    const result = await input.modelsFactory.generateText({
      systemPrompt: SUMMARIZE_SYSTEM_PROMPT,
      prompt: transcript,
      runtimeConfig: target.runtimeConfig,
      model: target.model,
      temperature: 0.3,
      maxTokens: 2000
    });

    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      const parsed = JSON.parse(jsonMatch[0]) as { soulContent: string; identityContent: string };
      return {
        soulContent: parsed.soulContent,
        identityContent: parsed.identityContent
      };
    } catch {
      return {
        soulContent: result.text,
        identityContent: "---\nname: Bandry\ntagline: Your local AI coding companion\n---\n\n# Identity\n"
      };
    }
  });

  // Skills API
  ipcMain.handle("skills:list", async () => {
    return input.skillService.list();
  });

  ipcMain.handle("skills:create", async (_event, createInput: SkillCreateInput) => {
    return input.skillService.create(createInput);
  });

  ipcMain.handle("skills:update", async (_event, name: string, updateInput: SkillUpdateInput) => {
    return input.skillService.update(name, updateInput);
  });

  ipcMain.handle("skills:delete", async (_event, name: string) => {
    return input.skillService.delete(name);
  });

  ipcMain.handle("skills:toggle", async (_event, toggleInput: SkillToggleInput) => {
    return input.skillService.toggle(toggleInput);
  });

  return {
    clearRunningTasks: (): void => {
      runningTasks.clear();
    }
  };
};

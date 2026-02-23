import { app, BrowserWindow } from "electron";
import { OpenVikingMemoryProvider, OpenVikingProcessManager } from "../memory/openviking";
import { createIpcEventBus } from "../ipc/event-bus";
import { registerIpcHandlers } from "../ipc/register-handlers";
import { createCompositionRoot } from "./composition-root";
import { createMainWindow } from "./window";

export const startMainApp = (): void => {
  const composition = createCompositionRoot();
  const eventBus = createIpcEventBus();

  const initializeOpenViking = async (): Promise<void> => {
    if (!composition.config.features.enableMemory || !composition.config.openviking.enabled) {
      return;
    }

    const manager = new OpenVikingProcessManager(composition.config);
    try {
      const { runtime } = await manager.start();
      console.log(`[OpenViking] started at ${runtime.url}`);

      composition.openViking.processManager = manager;
      composition.openViking.memoryProvider = new OpenVikingMemoryProvider(manager.createHttpClient(), {
        targetUris: composition.config.openviking.targetUris,
        topK: composition.config.openviking.memoryTopK,
        scoreThreshold: composition.config.openviking.memoryScoreThreshold,
        commitDebounceMs: composition.config.openviking.commitDebounceMs
      });
    } catch (error) {
      console.error("[OpenViking] failed to start, memory integration disabled:", error);
      await manager.stop();
      composition.openViking.processManager = null;
      composition.openViking.memoryProvider = null;
    }
  };

  const { clearRunningTasks } = registerIpcHandlers({
    config: composition.config,
    toolPlanningChatAgent: composition.toolPlanningChatAgent,
    orchestrator: composition.orchestrator,
    sandboxService: composition.sandboxService,
    settingsService: composition.settingsService,
    modelOnboardingService: composition.modelOnboardingService,
    conversationStore: composition.conversationStore,
    eventBus
  });

  app.whenReady().then(async () => {
    await initializeOpenViking();
    await createMainWindow({
      devServerUrl: composition.config.runtime.devServerUrl
    });

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow({
          devServerUrl: composition.config.runtime.devServerUrl
        });
      }
    });
  });

  app.on("window-all-closed", () => {
    clearRunningTasks();
    void composition.openViking.memoryProvider?.flush();
    void composition.openViking.processManager?.stop();

    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    void composition.openViking.memoryProvider?.flush();
    void composition.openViking.processManager?.stop();
  });
};

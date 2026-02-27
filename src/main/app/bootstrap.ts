import { app, BrowserWindow } from "electron";
import { OpenVikingMemoryProvider, OpenVikingProcessManager } from "../memory/openviking";
import { createIpcEventBus } from "../ipc/event-bus";
import { registerIpcHandlers } from "../ipc/register-handlers";
import { createCompositionRoot } from "./composition-root";
import { createMainWindow } from "./window";

export const startMainApp = (): void => {
  const composition = createCompositionRoot();
  const eventBus = createIpcEventBus();

  const shutdownOpenViking = async (): Promise<void> => {
    await composition.openViking.memoryProvider?.flush();
    await composition.openViking.processManager?.stop();
    composition.openViking.processManager = null;
    composition.openViking.memoryProvider = null;
    composition.toolPlanningChatAgent.setMemoryProvider(null);
  };

  const syncOpenViking = async (): Promise<void> => {
    const shouldRun =
      composition.config.features.enableMemory && composition.config.openviking.enabled;

    if (!shouldRun) {
      if (composition.openViking.processManager) {
        console.log("[OpenViking] Memory disabled, shutting down...");
        await shutdownOpenViking();
      }
      return;
    }

    if (composition.openViking.processManager) {
      const runtime = composition.openViking.processManager.getRuntime();
      if (runtime) {
        return;
      }
    }

    const manager = new OpenVikingProcessManager(composition.config);

    const rebindMemoryProvider = (): void => {
      try {
        composition.openViking.memoryProvider = new OpenVikingMemoryProvider(manager.createHttpClient(), {
          targetUris: composition.config.openviking.targetUris,
          topK: composition.config.openviking.memoryTopK,
          scoreThreshold: composition.config.openviking.memoryScoreThreshold,
          commitDebounceMs: composition.config.openviking.commitDebounceMs
        });
        composition.toolPlanningChatAgent.setMemoryProvider(composition.openViking.memoryProvider);
      } catch {
        composition.openViking.memoryProvider = null;
        composition.toolPlanningChatAgent.setMemoryProvider(null);
      }
    };

    manager.onCrash(({ willRestart }) => {
      if (willRestart) {
        console.log("[OpenViking] Rebinding memory provider after auto-restart");
        rebindMemoryProvider();
      } else {
        console.error("[OpenViking] Process crashed and could not be restarted");
        composition.openViking.processManager = null;
        composition.openViking.memoryProvider = null;
        composition.toolPlanningChatAgent.setMemoryProvider(null);
      }
    });

    try {
      const { runtime } = await manager.start();
      console.log(`[OpenViking] started at ${runtime.url}`);

      composition.openViking.processManager = manager;
      rebindMemoryProvider();
    } catch (error) {
      console.error("[OpenViking] failed to start, memory integration disabled:", error);
      await manager.stop();
      composition.openViking.processManager = null;
      composition.openViking.memoryProvider = null;
      composition.toolPlanningChatAgent.setMemoryProvider(null);
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
    eventBus,
    getOpenViking: () => ({
      processManager: composition.openViking.processManager,
      httpClient: composition.openViking.processManager?.getRuntime()
        ? composition.openViking.processManager.createHttpClient()
        : null
    }),
    onSettingsSaved: () => {
      void syncOpenViking();
    }
  });

  app.whenReady().then(async () => {
    await syncOpenViking();
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
    void shutdownOpenViking();

    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    void shutdownOpenViking();
  });
};

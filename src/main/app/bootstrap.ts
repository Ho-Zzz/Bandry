import { app, BrowserWindow } from "electron";
import { OpenVikingMemoryProvider, OpenVikingProcessManager } from "../memory/openviking";
import { createIpcEventBus } from "../ipc/event-bus";
import { registerIpcHandlers } from "../ipc/register-handlers";
import { buildConfiguredChannels, createCompositionRoot } from "./composition-root";
import { createMainWindow } from "./window";
import { ensureSoulFiles } from "../soul";
import { SoulService } from "../soul/soul-service";
import { SkillService } from "../skills/skill-service";
import { runtimeLogger } from "../logging/runtime-logger";
import { CronStore, CronRunner, CronService } from "../cron";

export const startMainApp = (): void => {
  const eventBus = createIpcEventBus();
  const composition = createCompositionRoot(eventBus);

  const shutdownOpenViking = async (): Promise<void> => {
    await composition.openViking.memoryProvider?.flush();
    await composition.openViking.processManager?.stop();
    composition.openViking.processManager = null;
    composition.openViking.memoryProvider = null;
  };

  const syncOpenViking = async (): Promise<void> => {
    const shouldRun =
      composition.config.features.enableMemory && composition.config.openviking.enabled;

    if (!shouldRun) {
      if (composition.openViking.processManager) {
        runtimeLogger.info({
          module: "openviking",
          phase: "lifecycle",
          msg: "Memory disabled, shutting down",
        });
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
        const persistTimeoutMs = Math.max(15_000, composition.config.openviking.startTimeoutMs);
        composition.openViking.memoryProvider = new OpenVikingMemoryProvider(manager.createHttpClient(3000), {
          targetUris: composition.config.openviking.targetUris,
          topK: composition.config.openviking.memoryTopK,
          scoreThreshold: composition.config.openviking.memoryScoreThreshold,
          commitDebounceMs: composition.config.openviking.commitDebounceMs,
          persistTimeoutMs,
          persistClient: manager.createHttpClient(persistTimeoutMs)
        });
      } catch {
        composition.openViking.memoryProvider = null;
      }
    };

    manager.onCrash(({ willRestart }) => {
      if (willRestart) {
        runtimeLogger.info({
          module: "openviking",
          phase: "restart",
          msg: "Rebinding memory provider after auto-restart",
        });
        rebindMemoryProvider();
      } else {
        runtimeLogger.error({
          module: "openviking",
          phase: "restart",
          msg: "Process crashed and could not be restarted",
        });
        composition.openViking.processManager = null;
        composition.openViking.memoryProvider = null;
      }
    });

    try {
      const { runtime } = await manager.start();
      runtimeLogger.info({
        module: "openviking",
        phase: "startup",
        msg: "Started",
        extra: {
          url: runtime.url,
        },
      });

      composition.openViking.processManager = manager;
      rebindMemoryProvider();
    } catch (error) {
      runtimeLogger.error({
        module: "openviking",
        phase: "startup",
        msg: "Failed to start, memory integration disabled",
        extra: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      await manager.stop();
      composition.openViking.processManager = null;
      composition.openViking.memoryProvider = null;
    }
  };

  const syncChannels = async (): Promise<void> => {
    await composition.channelManager.reconfigure(
      composition.config.channels,
      buildConfiguredChannels(composition.config.channels)
    );
  };

  const cronStore = new CronStore(composition.config.paths.cronDir);
  const cronRunner = new CronRunner(composition.toolPlanningChatAgent);
  const cronService = new CronService({
    store: cronStore,
    runner: cronRunner,
    broadcastCronRunEvent: eventBus.broadcastCronRunEvent
  });

  const { clearRunningTasks } = registerIpcHandlers({
    config: composition.config,
    chatAgentFactory: composition.chatAgentFactory,
    orchestrator: composition.orchestrator,
    sandboxService: composition.sandboxService,
    settingsService: composition.settingsService,
    modelOnboardingService: composition.modelOnboardingService,
    conversationStore: composition.conversationStore,
    userFilesService: composition.userFilesService,
    eventBus,
    getOpenViking: () => ({
      processManager: composition.openViking.processManager,
      httpClient: composition.openViking.processManager?.getRuntime()
        ? composition.openViking.processManager.createHttpClient()
        : null
    }),
    soulService: new SoulService(composition.config.paths.soulDir),
    skillService: new SkillService(composition.config.paths.skillsDir),
    modelsFactory: composition.modelsFactory,
    cronService,
    onSettingsSaved: () => {
      void syncChannels();
      void syncOpenViking();
    }
  });

  app.whenReady().then(async () => {
    await ensureSoulFiles(composition.config.paths.soulDir);
    await cronService.start();
    await syncOpenViking();
    await syncChannels();
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
    cronService.stop();
    void composition.channelManager.stopAll();
    void shutdownOpenViking();

    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", () => {
    void composition.channelManager.stopAll();
    void shutdownOpenViking();
  });
};

import { loadAppConfig } from "../config";
import { ensureUserConfigFile } from "../config/ensure-user-config";
import { ChannelManager } from "../channels/channel-manager";
import { FeishuChannel } from "../channels/feishu";
import type { Channel } from "../channels";
import { ModelsCatalogService } from "../llm";
import { ModelsFactory } from "../llm/runtime";
import { OpenVikingMemoryProvider, OpenVikingProcessManager } from "../memory/openviking";
import { ToolPlanningChatAgent } from "../orchestration/chat";
import { LocalOrchestrator } from "../orchestration/workflow";
import { SandboxService } from "../sandbox";
import { ModelOnboardingService, SettingsService } from "../settings";
import { ConversationStore } from "../persistence/sqlite";
import { UserFilesService, ConversationExporter } from "../user-files";
import type { IpcEventBus } from "../ipc/event-bus";

export type MainCompositionRoot = {
  config: ReturnType<typeof loadAppConfig>;
  modelsFactory: ModelsFactory;
  sandboxService: SandboxService;
  toolPlanningChatAgent: ToolPlanningChatAgent;
  orchestrator: LocalOrchestrator;
  conversationStore: ConversationStore;
  settingsService: SettingsService;
  modelOnboardingService: ModelOnboardingService;
  channelManager: ChannelManager;
  userFilesService: UserFilesService;
  openViking: {
    processManager: OpenVikingProcessManager | null;
    memoryProvider: OpenVikingMemoryProvider | null;
  };
};

export const buildConfiguredChannels = (
  channelsConfig: ReturnType<typeof loadAppConfig>["channels"]
): Channel[] => {
  const channels: Channel[] = [];
  for (const channelCfg of channelsConfig.channels) {
    if (channelCfg.type !== "feishu" || channelCfg.enabled === false) {
      continue;
    }
    channels.push(
      new FeishuChannel({
        type: "feishu",
        appId: channelCfg.appId,
        appSecret: channelCfg.appSecret,
        allowedChatIds: channelCfg.allowedChatIds
      })
    );
  }
  return channels;
};

export const createCompositionRoot = (eventBus: IpcEventBus): MainCompositionRoot => {
  const config = loadAppConfig();
  ensureUserConfigFile(config);
  console.info("Config source: defaults + project(optional) + userConfig; env disabled");
  const modelsFactory = new ModelsFactory(config);
  const sandboxService = new SandboxService(config);
  const conversationStore = new ConversationStore(config.paths.databasePath);

  // Create user files services
  const conversationExporter = new ConversationExporter(conversationStore);
  const userFilesService = new UserFilesService(
    conversationStore.getDatabase(),
    config.paths.resourcesDir,
    conversationExporter,
    undefined // OpenViking client will be set later when available
  );

  // Initialize user files directory
  userFilesService.initialize().catch((error) => {
    console.error("Failed to initialize user files service:", error);
  });

  const toolPlanningChatAgent = new ToolPlanningChatAgent(
    config,
    modelsFactory,
    sandboxService,
    conversationStore
  );
  const orchestrator = new LocalOrchestrator(config, sandboxService, modelsFactory);

  const settingsService = new SettingsService({ config });
  const modelsCatalogService = new ModelsCatalogService(config);
  const modelOnboardingService = new ModelOnboardingService(settingsService, modelsCatalogService);

  const channelManager = new ChannelManager(
    toolPlanningChatAgent,
    conversationStore,
    eventBus,
    config.channels
  );

  for (const channel of buildConfiguredChannels(config.channels)) {
    channelManager.register(channel);
  }

  return {
    config,
    modelsFactory,
    sandboxService,
    toolPlanningChatAgent,
    orchestrator,
    conversationStore,
    settingsService,
    modelOnboardingService,
    channelManager,
    userFilesService,
    openViking: {
      processManager: null,
      memoryProvider: null
    }
  };
};

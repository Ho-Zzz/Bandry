import { loadAppConfig } from "../config";
import { ModelsCatalogService } from "../llm";
import { ModelsFactory } from "../llm/runtime";
import { OpenVikingMemoryProvider, OpenVikingProcessManager } from "../memory/openviking";
import { ToolPlanningChatAgent } from "../orchestration/chat";
import { LocalOrchestrator } from "../orchestration/workflow";
import { SandboxService } from "../sandbox";
import { ModelOnboardingService, SettingsService } from "../settings";
import { ConversationStore } from "../persistence/sqlite";

export type MainCompositionRoot = {
  config: ReturnType<typeof loadAppConfig>;
  modelsFactory: ModelsFactory;
  sandboxService: SandboxService;
  toolPlanningChatAgent: ToolPlanningChatAgent;
  orchestrator: LocalOrchestrator;
  conversationStore: ConversationStore;
  settingsService: SettingsService;
  modelOnboardingService: ModelOnboardingService;
  openViking: {
    processManager: OpenVikingProcessManager | null;
    memoryProvider: OpenVikingMemoryProvider | null;
  };
};

export const createCompositionRoot = (): MainCompositionRoot => {
  const config = loadAppConfig();
  const modelsFactory = new ModelsFactory(config);
  const sandboxService = new SandboxService(config);
  const toolPlanningChatAgent = new ToolPlanningChatAgent(config, modelsFactory, sandboxService);
  const orchestrator = new LocalOrchestrator(config, sandboxService, modelsFactory);
  const conversationStore = new ConversationStore(config.paths.databasePath);

  const settingsService = new SettingsService({ config });
  const modelsCatalogService = new ModelsCatalogService(config);
  const modelOnboardingService = new ModelOnboardingService(settingsService, modelsCatalogService);

  return {
    config,
    modelsFactory,
    sandboxService,
    toolPlanningChatAgent,
    orchestrator,
    conversationStore,
    settingsService,
    modelOnboardingService,
    openViking: {
      processManager: null,
      memoryProvider: null
    }
  };
};

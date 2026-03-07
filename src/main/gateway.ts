import { OpenVikingMemoryProvider, OpenVikingProcessManager } from "./memory/openviking";
import { createCompositionRoot } from "./app/composition-root";
import type { IpcEventBus } from "./ipc/event-bus";

const eventBus: IpcEventBus = {
  broadcastTaskUpdate: (u) => console.log("[event:task]", u.status),
  broadcastChatUpdate: (u) => console.log("[event:chat]", u.stage, u.message),
  broadcastChatDelta: () => {},
  broadcastChannelStatus: (u) => console.log("[event:channel]", u.channelId, u.status),
};

const composition = createCompositionRoot(eventBus);

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

  if (!shouldRun) return;

  const manager = new OpenVikingProcessManager(composition.config);
  try {
    const { runtime } = await manager.start();
    console.log(`[Gateway] OpenViking started at ${runtime.url}`);

    composition.openViking.processManager = manager;
    composition.openViking.memoryProvider = new OpenVikingMemoryProvider(
      manager.createHttpClient(),
      {
        targetUris: composition.config.openviking.targetUris,
        topK: composition.config.openviking.memoryTopK,
        scoreThreshold: composition.config.openviking.memoryScoreThreshold,
        commitDebounceMs: composition.config.openviking.commitDebounceMs,
      }
    );
    composition.toolPlanningChatAgent.setMemoryProvider(
      composition.openViking.memoryProvider
    );
  } catch (error) {
    console.error("[Gateway] OpenViking failed to start, memory disabled:", error);
    await manager.stop();
    composition.openViking.processManager = null;
    composition.openViking.memoryProvider = null;
    composition.toolPlanningChatAgent.setMemoryProvider(null);
  }
};

const shutdown = async (): Promise<void> => {
  console.log("[Gateway] Shutting down...");
  await composition.channelManager.stopAll();
  await shutdownOpenViking();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

const main = async (): Promise<void> => {
  console.log("[Gateway] Starting Bandry Gateway...");

  await syncOpenViking();

  if (composition.config.channels.enabled) {
    console.log("[Gateway] Channels enabled, starting channel manager...");
    await composition.channelManager.startAll();
  } else {
    console.log("[Gateway] No channels enabled. Configure channels in Settings to activate.");
  }

  console.log("[Gateway] Gateway running. Press Ctrl+C to stop.");
};

main().catch((err) => {
  console.error("[Gateway] Fatal error:", err);
  process.exit(1);
});

import type { ToolPlanningChatAgent } from "../orchestration/chat";
import type { ConversationStore } from "../persistence/sqlite";
import type { IpcEventBus } from "../ipc/event-bus";
import type {
  Channel,
  ChannelStatusEvent,
  NormalizedInboundMessage,
  ChannelStatus,
} from "./types";

const MAX_HISTORY_MESSAGES = 20;

export class ChannelManager {
  private readonly channels = new Map<string, Channel>();
  private readonly conversationMap = new Map<string, string>();

  constructor(
    private readonly chatAgent: ToolPlanningChatAgent,
    private readonly conversationStore: ConversationStore,
    private readonly eventBus: IpcEventBus,
    private readonly channelsConfig: { enabled: boolean },
  ) {}

  register(channel: Channel): void {
    channel.onMessage = (msg) => {
      void this.handleInbound(channel, msg);
    };
    this.channels.set(channel.id, channel);
  }

  async startAll(): Promise<void> {
    if (!this.channelsConfig.enabled) {
      return;
    }

    for (const channel of this.channels.values()) {
      try {
        await channel.start();
        this.broadcastStatus(channel.id, channel.getStatus());
      } catch (error) {
        console.error(`[ChannelManager] Failed to start channel ${channel.id}:`, error);
        this.broadcastStatus(channel.id, "error", String(error));
      }
    }
  }

  async stopAll(): Promise<void> {
    for (const channel of this.channels.values()) {
      try {
        await channel.stop();
        this.broadcastStatus(channel.id, "stopped");
      } catch (error) {
        console.error(`[ChannelManager] Failed to stop channel ${channel.id}:`, error);
      }
    }
  }

  private resolveConversation(channelId: string, platformChatId: string): string {
    const key = `${channelId}::${platformChatId}`;
    const existing = this.conversationMap.get(key);
    if (existing) {
      return existing;
    }

    const conversation = this.conversationStore.createConversation({
      title: `Channel: ${key}`,
    });
    this.conversationMap.set(key, conversation.id);
    return conversation.id;
  }

  private async handleInbound(channel: Channel, msg: NormalizedInboundMessage): Promise<void> {
    try {
      const conversationId = this.resolveConversation(msg.channelId, msg.platformChatId);

      this.conversationStore.createMessage({
        conversation_id: conversationId,
        role: "user",
        content: msg.text,
        status: "completed",
      });

      const allMessages = this.conversationStore.listMessages(conversationId);
      const recent = allMessages.slice(-MAX_HISTORY_MESSAGES);
      const history = recent.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      const result = await this.chatAgent.send({
        conversationId,
        message: msg.text,
        history,
      });

      this.conversationStore.createMessage({
        conversation_id: conversationId,
        role: "assistant",
        content: result.reply,
        status: "completed",
      });

      await channel.sendReply({
        conversationId,
        platformChatId: msg.platformChatId,
        text: result.reply,
      });
    } catch (error) {
      console.error(`[ChannelManager] Error handling inbound from ${channel.id}:`, error);
    }
  }

  private broadcastStatus(channelId: string, status: ChannelStatus, message?: string): void {
    const event: ChannelStatusEvent = {
      channelId,
      status,
      message,
      timestamp: Date.now(),
    };
    this.eventBus.broadcastChannelStatus(event);
  }
}

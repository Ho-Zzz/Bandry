import type { ToolPlanningChatAgent } from "../orchestration/chat";
import type { ConversationStore } from "../persistence/sqlite";
import type { IpcEventBus } from "../ipc/event-bus";
import type {
  Channel,
  ChannelStatusEvent,
  NormalizedInboundMessage,
  ChannelStatus,
} from "./types";
import { parseChannelCommand } from "./parse-command";

const MAX_HISTORY_MESSAGES = 20;

const CHANNEL_SYSTEM_HINT = [
  "You are operating in a non-interactive messaging channel (e.g. Feishu/Lark).",
  "The user CANNOT select clarification options or interact with UI buttons.",
  "IMPORTANT: Do NOT call ask_clarification unless the request is truly impossible to act on.",
  "Prefer making reasonable default assumptions and proceeding with the task directly.",
  "If you must ask a question, use action=answer to reply with your question as plain text.",
].join(" ");

export class ChannelManager {
  private readonly channels = new Map<string, Channel>();
  private readonly conversationMap = new Map<string, string>();
  private readonly activeRequests = new Map<string, AbortController>();

  constructor(
    private readonly chatAgent: ToolPlanningChatAgent,
    private readonly conversationStore: ConversationStore,
    private readonly eventBus: IpcEventBus,
    private channelsConfig: { enabled: boolean },
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

  async reconfigure(nextConfig: { enabled: boolean }, nextChannels: Channel[]): Promise<void> {
    for (const controller of this.activeRequests.values()) {
      controller.abort();
    }
    this.activeRequests.clear();

    await this.stopAll();
    this.channels.clear();
    this.conversationMap.clear();
    this.channelsConfig = { enabled: nextConfig.enabled };

    for (const channel of nextChannels) {
      this.register(channel);
    }
    await this.startAll();
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
    const requestKey = `${msg.channelId}::${msg.platformChatId}`;

    try {
      const command = parseChannelCommand(msg.text);

      // Empty message after stripping commands (e.g. bare "/think") — reply with usage hint
      if (!command.text) {
        await channel.sendReply({
          conversationId: "",
          platformChatId: msg.platformChatId,
          text: `已切换为 ${command.mode} 模式，请在指令后输入消息内容。\n示例：/think 帮我分析这个问题`,
        });
        return;
      }

      const requestId = `channel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      // Abort any in-flight request for the same chat window
      const prev = this.activeRequests.get(requestKey);
      if (prev) {
        prev.abort();
      }
      const controller = new AbortController();
      this.activeRequests.set(requestKey, controller);

      const conversationId = this.resolveConversation(msg.channelId, msg.platformChatId);

      // Store the cleaned message (without command prefixes)
      this.conversationStore.createMessage({
        conversation_id: conversationId,
        role: "user",
        content: command.text,
        status: "completed",
      });

      const allMessages = this.conversationStore.listMessages(conversationId);
      const recent = allMessages.slice(-MAX_HISTORY_MESSAGES);
      const history = [
        { role: "system" as const, content: CHANNEL_SYSTEM_HINT },
        ...recent.map((m) => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      ];

      const result = await this.chatAgent.send(
        {
          requestId,
          conversationId,
          message: command.text,
          history,
          mode: command.mode,
          modelProfileId: command.modelProfileId,
        },
        (stage, message, payload) => {
          this.eventBus.broadcastChatUpdate({ requestId, stage, message, timestamp: Date.now(), payload });
        },
        (delta) => {
          this.eventBus.broadcastChatDelta({ requestId, delta, timestamp: Date.now() });
        },
        controller.signal,
      );

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
      if (error instanceof Error && (error.name === "AbortError" || error.message === "Request cancelled by user")) {
        console.log(`[ChannelManager] Request aborted for ${requestKey}`);
        return;
      }
      console.error(`[ChannelManager] Error handling inbound from ${channel.id}:`, error);
    } finally {
      this.activeRequests.delete(requestKey);
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

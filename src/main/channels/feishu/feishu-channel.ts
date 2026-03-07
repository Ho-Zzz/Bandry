import * as lark from "@larksuiteoapi/node-sdk";
import type {
  Channel,
  ChannelStatus,
  FeishuChannelConfig,
  NormalizedInboundMessage,
  OutboundReply,
} from "../types";
import type { FeishuRawEventData } from "./feishu-types";
import { normalizeFeishuMessage } from "./feishu-message-adapter";

const CHANNEL_ID_PREFIX = "feishu";

export class FeishuChannel implements Channel {
  readonly id: string;
  onMessage: (msg: NormalizedInboundMessage) => void = () => {};

  private status: ChannelStatus = "stopped";
  private larkClient: lark.Client | null = null;
  private wsClient: lark.WSClient | null = null;
  private readonly allowedChatIds: Set<string> | null;

  constructor(private readonly config: FeishuChannelConfig) {
    this.id = `${CHANNEL_ID_PREFIX}:${config.appId}`;
    this.allowedChatIds =
      config.allowedChatIds && config.allowedChatIds.length > 0
        ? new Set(config.allowedChatIds)
        : null;
  }

  getStatus(): ChannelStatus {
    return this.status;
  }

  async start(): Promise<void> {
    if (this.status === "running") {
      return;
    }

    this.status = "starting";

    try {
      this.larkClient = new lark.Client({
        appId: this.config.appId,
        appSecret: this.config.appSecret,
      });

      const eventDispatcher = new lark.EventDispatcher({}).register({
        "im.message.receive_v1": (data: FeishuRawEventData) => {
          this.handleRawEvent(data);
        },
      });

      this.wsClient = new lark.WSClient({
        appId: this.config.appId,
        appSecret: this.config.appSecret,
        loggerLevel: lark.LoggerLevel.warn,
      });

      await this.wsClient.start({ eventDispatcher });
      this.status = "running";
      console.log(`[FeishuChannel] Started (${this.id})`);
    } catch (error) {
      this.status = "error";
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.wsClient) {
      this.wsClient.close();
    }
    this.wsClient = null;
    this.larkClient = null;
    this.status = "stopped";
    console.log(`[FeishuChannel] Stopped (${this.id})`);
  }

  async sendReply(reply: OutboundReply): Promise<void> {
    if (!this.larkClient) {
      throw new Error(`[FeishuChannel] Cannot send reply: client not initialized (${this.id})`);
    }

    await this.larkClient.im.message.create({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: reply.platformChatId,
        msg_type: "text",
        content: JSON.stringify({ text: reply.text }),
      },
    });
  }

  private handleRawEvent(data: FeishuRawEventData): void {
    if (!data.message) {
      return;
    }

    if (this.allowedChatIds && !this.allowedChatIds.has(data.message.chat_id)) {
      console.log(
        `[FeishuChannel] Ignoring message from non-allowed chat: ${data.message.chat_id}`,
      );
      return;
    }

    const normalized = normalizeFeishuMessage(this.id, data);
    if (!normalized) {
      return;
    }

    this.onMessage(normalized);
  }
}

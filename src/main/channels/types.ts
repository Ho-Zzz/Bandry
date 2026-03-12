export type ChannelId = string;

export type NormalizedInboundMessage = {
  platformMessageId: string;
  channelId: ChannelId;
  platformChatId: string;
  sender: string;
  text: string;
  messageType: "text";
  timestamp: number;
  metadata?: Record<string, unknown>;
};

export type OutboundReply = {
  conversationId: string;
  platformChatId: string;
  text: string;
};

export type ChannelStatus = "stopped" | "starting" | "running" | "error";

export type ChannelStatusEvent = {
  channelId: ChannelId;
  status: ChannelStatus;
  message?: string;
  timestamp: number;
};

export type Channel = {
  readonly id: ChannelId;
  start(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): ChannelStatus;
  sendReply(reply: OutboundReply): Promise<void>;
  onMessage: (msg: NormalizedInboundMessage) => void;
};

export type FeishuChannelConfig = {
  type: "feishu";
  appId: string;
  appSecret: string;
  allowedChatIds?: string[];
};

export type ChannelConfig = FeishuChannelConfig;

export type ChannelsConfig = {
  enabled: boolean;
  channels: ChannelConfig[];
};

import type { NormalizedInboundMessage } from "../types";
import type { FeishuRawEventData } from "./feishu-types";

export const normalizeFeishuMessage = (
  channelId: string,
  data: FeishuRawEventData,
): NormalizedInboundMessage | null => {
  if (data.message.message_type !== "text") {
    return null;
  }

  let text: string;
  try {
    const parsed = JSON.parse(data.message.content) as { text?: string };
    text = parsed.text ?? "";
  } catch {
    return null;
  }

  if (!text.trim()) {
    return null;
  }

  const senderId =
    data.sender.sender_id?.open_id ??
    data.sender.sender_id?.user_id ??
    data.sender.sender_id?.union_id ??
    "unknown";

  return {
    platformMessageId: data.message.message_id,
    channelId,
    platformChatId: data.message.chat_id,
    sender: senderId,
    text,
    messageType: "text",
    timestamp: data.message.create_time ? Number(data.message.create_time) : Date.now(),
  };
};

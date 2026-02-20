import type { ChatHistoryMessage, ChatUpdateEvent } from "../../../shared/ipc";
import type { ChatMessage } from "./types";

export const createClientMessageId = (): string => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const toChatHistory = (messages: ChatMessage[]): ChatHistoryMessage[] => {
  return messages
    .filter((item) => item.role === "assistant" || item.role === "user")
    .map((item) => ({
      role: item.role,
      content: item.content
    }))
    .slice(-20);
};

export const formatChatUpdateLine = (update: ChatUpdateEvent): string => {
  return `[${update.stage}] ${update.message}`;
};

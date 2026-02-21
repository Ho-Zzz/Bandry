import type { ChatHistoryMessage, ChatSendResult } from "../../shared/ipc";
import type { GenerateTextResult } from "../models";

export const normalizeHistory = (history: ChatHistoryMessage[]): ChatHistoryMessage[] => {
  return history
    .filter((item) => item.role === "system" || item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role,
      content: item.content.trim()
    }))
    .filter((item) => Boolean(item.content))
    .slice(-20);
};

export const toModelMeta = (result: GenerateTextResult): Omit<ChatSendResult, "reply"> => ({
  provider: result.provider,
  model: result.model,
  latencyMs: result.latencyMs
});

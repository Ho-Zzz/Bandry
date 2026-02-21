/**
 * Copilot Chat Hook
 *
 * Manages chat state and communication with backend
 */

import { useState, useEffect, useCallback } from "react";
import type { ChatUpdateEvent, ChatHistoryMessage } from "../../../shared/ipc";

export type MessageStatus = "pending" | "completed" | "error";

export type Message = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  status?: MessageStatus;
  timestamp: number;
  trace?: ChatUpdateEvent[];
};

type UseCopilotChatOptions = {
  modelProfileId?: string;
};

export function useCopilotChat(options: UseCopilotChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Subscribe to chat updates
  useEffect(() => {
    const unsubscribe = window.api.onChatUpdate((update) => {
      setMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === "assistant" && lastMessage.status === "pending") {
          return [
            ...prev.slice(0, -1),
            {
              ...lastMessage,
              trace: [...(lastMessage.trace || []), update],
            },
          ];
        }
        return prev;
      });
    });

    return unsubscribe;
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessageId = `user-${Date.now()}`;
      const assistantMessageId = `assistant-${Date.now()}`;

      // Add user message
      const userMessage: Message = {
        id: userMessageId,
        role: "user",
        content,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);

      // Add pending assistant message
      const pendingMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        status: "pending",
        timestamp: Date.now(),
        trace: [],
      };

      setMessages((prev) => [...prev, pendingMessage]);
      setIsLoading(true);

      try {
        // Build history (exclude the pending message)
        const history: ChatHistoryMessage[] = messages.map((m) => ({
          role: m.role === "system" ? "system" : m.role,
          content: m.content,
        }));

        // Call backend API (using legacy chatSend for now)
        const result = await window.api.chatSend({
          message: content,
          history,
          modelProfileId: options.modelProfileId,
        });

        // Update pending message with final response
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: result.reply,
                  status: "completed" as MessageStatus,
                }
              : m
          )
        );
      } catch (error) {
        console.error("Chat error:", error);

        // Update pending message with error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: error instanceof Error ? error.message : "An error occurred",
                  status: "error" as MessageStatus,
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, options.modelProfileId]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    sendMessage,
    clearMessages,
    isLoading,
  };
}

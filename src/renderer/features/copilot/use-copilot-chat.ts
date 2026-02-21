/**
 * Copilot Chat Hook
 *
 * Manages chat state and communication with backend.
 * Supports conversation persistence via IPC.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatUpdateEvent, ChatHistoryMessage, MessageResult } from "../../../shared/ipc";
import { useConversationStore } from "../../store/use-conversation-store";

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
  conversationId?: string;
  modelProfileId?: string;
};

export function useCopilotChat(options: UseCopilotChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(options.conversationId);
  const titleGeneratedRef = useRef(false);
  const { updateConversationTitle } = useConversationStore();

  // Load existing messages when conversationId changes
  useEffect(() => {
    if (options.conversationId) {
      setConversationId(options.conversationId);
      titleGeneratedRef.current = true; // Existing conversation already has title
      loadMessages(options.conversationId);
    } else {
      setConversationId(undefined);
      setMessages([]);
      titleGeneratedRef.current = false;
    }
  }, [options.conversationId]);

  const loadMessages = async (convId: string) => {
    try {
      const dbMessages = await window.api.messageList(convId);
      const loadedMessages: Message[] = dbMessages.map((m: MessageResult) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        status: m.status,
        timestamp: m.created_at,
        trace: m.trace ? JSON.parse(m.trace) : undefined
      }));
      setMessages(loadedMessages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

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
              trace: [...(lastMessage.trace || []), update]
            }
          ];
        }
        return prev;
      });
    });

    return unsubscribe;
  }, []);

  const generateTitle = useCallback(
    async (userMessage: string, convId: string) => {
      if (titleGeneratedRef.current) return;
      titleGeneratedRef.current = true;

      // Generate a simple title from the first message (first 50 chars)
      const title = userMessage.length > 50 ? userMessage.slice(0, 47) + "..." : userMessage;
      try {
        await updateConversationTitle(convId, title);
      } catch (error) {
        console.error("Failed to generate title:", error);
      }
    },
    [updateConversationTitle]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessageId = `user-${Date.now()}`;
      const assistantMessageId = `assistant-${Date.now()}`;

      // Create conversation if needed
      let currentConvId: string;
      if (conversationId) {
        currentConvId = conversationId;
      } else {
        try {
          const conv = await window.api.conversationCreate({
            model_profile_id: options.modelProfileId
          });
          currentConvId = conv.id;
          setConversationId(currentConvId);
        } catch (error) {
          console.error("Failed to create conversation:", error);
          return;
        }
      }

      // Add user message
      const userMessage: Message = {
        id: userMessageId,
        role: "user",
        content,
        timestamp: Date.now()
      };

      setMessages((prev) => [...prev, userMessage]);

      // Save user message to database
      try {
        const savedUserMsg = await window.api.messageCreate({
          conversation_id: currentConvId,
          role: "user",
          content,
          status: "completed"
        });
        userMessage.id = savedUserMsg.id;
      } catch (error) {
        console.error("Failed to save user message:", error);
      }

      // Add pending assistant message
      const pendingMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        status: "pending",
        timestamp: Date.now(),
        trace: []
      };

      setMessages((prev) => [...prev, pendingMessage]);
      setIsLoading(true);

      // Create pending assistant message in database
      let savedAssistantMsgId: string | undefined;
      try {
        const savedMsg = await window.api.messageCreate({
          conversation_id: currentConvId,
          role: "assistant",
          content: "",
          status: "pending"
        });
        savedAssistantMsgId = savedMsg.id;
      } catch (error) {
        console.error("Failed to create pending message:", error);
      }

      try {
        // Build history (exclude the pending message)
        const history: ChatHistoryMessage[] = messages.map((m) => ({
          role: m.role === "system" ? "system" : m.role,
          content: m.content
        }));

        // Call backend API
        const result = await window.api.chatSend({
          message: content,
          history,
          modelProfileId: options.modelProfileId
        });

        // Update pending message with final response
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  id: savedAssistantMsgId || m.id,
                  content: result.reply,
                  status: "completed" as MessageStatus
                }
              : m
          )
        );

        // Update message in database
        if (savedAssistantMsgId) {
          const finalTrace = messages.find((m) => m.id === assistantMessageId)?.trace;
          await window.api.messageUpdate(savedAssistantMsgId, {
            content: result.reply,
            status: "completed",
            trace: finalTrace ? JSON.stringify(finalTrace) : undefined
          });
        }

        // Generate title after first exchange
        await generateTitle(content, currentConvId);
      } catch (error) {
        console.error("Chat error:", error);

        const errorMessage = error instanceof Error ? error.message : "An error occurred";

        // Update pending message with error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  content: errorMessage,
                  status: "error" as MessageStatus
                }
              : m
          )
        );

        // Update message in database
        if (savedAssistantMsgId) {
          await window.api.messageUpdate(savedAssistantMsgId, {
            content: errorMessage,
            status: "error"
          });
        }
      } finally {
        setIsLoading(false);
      }
    },
    [messages, options.modelProfileId, conversationId, generateTitle]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    titleGeneratedRef.current = false;
  }, []);

  return {
    messages,
    sendMessage,
    clearMessages,
    isLoading,
    conversationId
  };
}

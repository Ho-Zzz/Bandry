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
  requestId?: string;
};

type UseCopilotChatOptions = {
  conversationId?: string;
  modelProfileId?: string;
};

const makeRequestId = (): string => {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

const getRequestIdFromTrace = (trace?: ChatUpdateEvent[]): string | undefined => {
  if (!trace || trace.length === 0) {
    return undefined;
  }

  const requestId = trace[0]?.requestId;
  return requestId?.trim() ? requestId : undefined;
};

export function useCopilotChat(options: UseCopilotChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(options.conversationId);
  const titleGeneratedRef = useRef(false);
  const traceByRequestIdRef = useRef<Record<string, ChatUpdateEvent[]>>({});
  const activeRequestIdRef = useRef<string | null>(null);
  const { updateConversationTitle } = useConversationStore();

  // Load existing messages when conversationId changes
  useEffect(() => {
    if (options.conversationId) {
      setConversationId(options.conversationId);
      titleGeneratedRef.current = true; // Existing conversation already has title
      void loadMessages(options.conversationId);
    } else {
      setConversationId(undefined);
      setMessages([]);
      traceByRequestIdRef.current = {};
      titleGeneratedRef.current = false;
    }
  }, [options.conversationId]);

  const loadMessages = async (convId: string) => {
    try {
      const dbMessages = await window.api.messageList(convId);
      const loadedMessages: Message[] = dbMessages.map((m: MessageResult) => {
        const trace = m.trace ? (JSON.parse(m.trace) as ChatUpdateEvent[]) : undefined;

        return {
          id: m.id,
          role: m.role,
          content: m.content,
          status: m.status,
          timestamp: m.created_at,
          trace,
          requestId: getRequestIdFromTrace(trace)
        };
      });

      const traces: Record<string, ChatUpdateEvent[]> = {};
      for (const message of loadedMessages) {
        if (message.requestId && message.trace) {
          traces[message.requestId] = message.trace;
        }
      }

      traceByRequestIdRef.current = traces;
      setMessages(loadedMessages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  // Subscribe to chat updates
  useEffect(() => {
    const unsubscribe = window.api.onChatUpdate((update) => {
      const previousTrace = traceByRequestIdRef.current[update.requestId] || [];
      const nextTrace = [...previousTrace, update];
      traceByRequestIdRef.current[update.requestId] = nextTrace;

      setMessages((prev) =>
        prev.map((message) => {
          if (message.role !== "assistant") {
            return message;
          }

          if (message.requestId !== update.requestId) {
            return message;
          }

          return {
            ...message,
            trace: nextTrace
          };
        })
      );
    });

    const unsubscribeDelta = window.api.onChatDelta((update) => {
      setMessages((prev) =>
        prev.map((message) => {
          if (message.role !== "assistant") {
            return message;
          }

          if (message.requestId !== update.requestId) {
            return message;
          }

          if (message.status !== "pending") {
            return message;
          }

          return {
            ...message,
            content: `${message.content}${update.delta}`
          };
        })
      );
    });

    return () => {
      unsubscribe();
      unsubscribeDelta();
    };
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
      const requestId = makeRequestId();
      const userMessageId = `user-${Date.now()}`;
      const assistantMessageId = `assistant-${Date.now()}`;
      activeRequestIdRef.current = requestId;

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
        timestamp: Date.now(),
        status: "completed"
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

        setMessages((prev) =>
          prev.map((message) => (message.id === userMessageId ? { ...message, id: savedUserMsg.id } : message))
        );
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
        trace: [],
        requestId
      };

      traceByRequestIdRef.current[requestId] = [];
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

        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId && message.requestId === requestId
              ? {
                  ...message,
                  id: savedMsg.id
                }
              : message
          )
        );
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
          requestId,
          message: content,
          history,
          modelProfileId: options.modelProfileId
        });

        const finalTrace = traceByRequestIdRef.current[requestId] || [];

        // Update pending message with final response
        setMessages((prev) =>
          prev.map((message) =>
            message.role === "assistant" && message.requestId === requestId
              ? {
                  ...message,
                  content: result.reply,
                  status: "completed" as MessageStatus,
                  trace: finalTrace
                }
              : message
          )
        );

        // Update message in database
        if (savedAssistantMsgId) {
          await window.api.messageUpdate(savedAssistantMsgId, {
            content: result.reply,
            status: "completed",
            trace: finalTrace.length > 0 ? JSON.stringify(finalTrace) : undefined
          });
        }

        // Generate title after first exchange
        await generateTitle(content, currentConvId);
      } catch (error) {
        console.error("Chat error:", error);

        const errorMessage = error instanceof Error ? error.message : "An error occurred";
        const isCancelled =
          errorMessage.toLowerCase().includes("cancelled") ||
          errorMessage.toLowerCase().includes("canceled") ||
          errorMessage.includes("中断");
        const finalTrace = traceByRequestIdRef.current[requestId] || [];
        let finalContentForDb = errorMessage;
        let finalStatus: MessageStatus = "error";

        // Update pending message with error
        setMessages((prev) =>
          prev.map((message) =>
            message.role === "assistant" && message.requestId === requestId
              ? {
                  ...message,
                  content: (() => {
                    const resolved = isCancelled ? message.content || "已中断当前生成" : errorMessage;
                    finalContentForDb = resolved;
                    return resolved;
                  })(),
                  status: (() => {
                    const resolved = isCancelled ? ("completed" as MessageStatus) : ("error" as MessageStatus);
                    finalStatus = resolved;
                    return resolved;
                  })(),
                  trace: finalTrace
                }
              : message
          )
        );

        // Update message in database
        if (savedAssistantMsgId) {
          await window.api.messageUpdate(savedAssistantMsgId, {
            content: finalContentForDb,
            status: finalStatus,
            trace: finalTrace.length > 0 ? JSON.stringify(finalTrace) : undefined
          });
        }
      } finally {
        setIsLoading(false);
        if (activeRequestIdRef.current === requestId) {
          activeRequestIdRef.current = null;
        }
      }
    },
    [messages, options.modelProfileId, conversationId, generateTitle]
  );

  const cancelCurrentRequest = useCallback(async (): Promise<boolean> => {
    const requestId = activeRequestIdRef.current;
    if (!requestId) {
      return false;
    }

    try {
      const result = await window.api.chatCancel({ requestId });
      if (result.cancelled) {
        activeRequestIdRef.current = null;
      }
      return result.cancelled;
    } catch (error) {
      console.error("Failed to cancel request:", error);
      return false;
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    traceByRequestIdRef.current = {};
    activeRequestIdRef.current = null;
    titleGeneratedRef.current = false;
  }, []);

  return {
    messages,
    sendMessage,
    cancelCurrentRequest,
    clearMessages,
    isLoading,
    conversationId
  };
}

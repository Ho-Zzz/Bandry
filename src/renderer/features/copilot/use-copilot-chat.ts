/**
 * Copilot Chat Hook
 *
 * Manages chat state and communication with backend.
 * Supports conversation persistence via IPC.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type {
  ChatClarificationOption,
  ChatHistoryMessage,
  ChatMode,
  ChatUpdateEvent,
  MessageResult
} from "../../../shared/ipc";
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

export type PendingClarification = {
  requestId: string;
  conversationId: string;
  question: string;
  options: ChatClarificationOption[];
};

type UseCopilotChatOptions = {
  conversationId?: string;
  mode?: ChatMode;
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

export const isConversationLoading = (
  activeRequestByConversation: Record<string, string>,
  conversationId?: string
): boolean => {
  if (!conversationId) {
    return false;
  }
  return Boolean(activeRequestByConversation[conversationId]);
};

export const resolvePendingClarificationFromUpdate = (
  update: ChatUpdateEvent,
  mappedConversationId: string | undefined,
  currentConversationId: string | undefined
): PendingClarification | null => {
  if (update.stage !== "clarification" || !mappedConversationId || mappedConversationId !== currentConversationId) {
    return null;
  }

  const clarification = update.payload?.clarification;
  if (!clarification) {
    return null;
  }

  return {
    requestId: update.requestId,
    conversationId: mappedConversationId,
    question: clarification.question,
    options: clarification.options
  };
};

export const normalizeClarificationInput = (value: string): string => value.trim();

/**
 * Module-level map storing workspace paths per conversation.
 * Persists across re-renders but not across page reloads.
 */
const workspaceByConversation = new Map<string, string>();

export const getConversationWorkspacePath = (conversationId: string): string | undefined => {
  return workspaceByConversation.get(conversationId);
};

export function useCopilotChat(options: UseCopilotChatOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(options.conversationId);
  const [activeRequestByConversation, setActiveRequestByConversation] = useState<Record<string, string>>({});
  const [pendingClarification, setPendingClarification] = useState<PendingClarification | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const traceByRequestIdRef = useRef<Record<string, ChatUpdateEvent[]>>({});
  const requestToConversationRef = useRef<Record<string, string>>({});
  const messagesRef = useRef<Message[]>([]);
  const conversationIdRef = useRef<string | undefined>(options.conversationId);
  const { upsertConversation } = useConversationStore();

  const isLoading = useMemo(() => {
    return isConversationLoading(activeRequestByConversation, conversationId);
  }, [activeRequestByConversation, conversationId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const setConversationActiveRequest = useCallback((convId: string, requestId: string | null) => {
    setActiveRequestByConversation((previous) => {
      if (!requestId) {
        if (!(convId in previous)) {
          return previous;
        }
        const next = { ...previous };
        delete next[convId];
        return next;
      }

      if (previous[convId] === requestId) {
        return previous;
      }

      return {
        ...previous,
        [convId]: requestId
      };
    });
  }, []);

  const clearConversationRequestIfMatch = useCallback((convId: string, requestId: string) => {
    setActiveRequestByConversation((previous) => {
      if (previous[convId] !== requestId) {
        return previous;
      }
      const next = { ...previous };
      delete next[convId];
      return next;
    });
  }, []);

  const loadMessages = useCallback(async (convId: string) => {
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
          requestToConversationRef.current[message.requestId] = convId;
        }
      }

      traceByRequestIdRef.current = traces;
      setMessages(loadedMessages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  }, []);

  // Load existing messages when conversationId changes
  useEffect(() => {
    if (options.conversationId) {
      setConversationId(options.conversationId);
      setMessages([]);
      setPendingClarification(null);
      traceByRequestIdRef.current = {};

      // Restore workspace path: prefer in-memory cache, fall back to DB
      const cachedWs = workspaceByConversation.get(options.conversationId);
      if (cachedWs) {
        setWorkspacePath(cachedWs);
      } else {
        window.api.conversationGet(options.conversationId).then((conv) => {
          if (conv?.workspace_path) {
            workspaceByConversation.set(options.conversationId!, conv.workspace_path);
            setWorkspacePath(conv.workspace_path);
          } else {
            setWorkspacePath(null);
          }
        }).catch(() => setWorkspacePath(null));
      }

      void loadMessages(options.conversationId);
    } else {
      setConversationId(undefined);
      setMessages([]);
      setPendingClarification(null);
      traceByRequestIdRef.current = {};
      setWorkspacePath(null);
    }
  }, [loadMessages, options.conversationId]);

  // Subscribe to chat updates
  useEffect(() => {
    const unsubscribe = window.api.onChatUpdate((update) => {
      const previousTrace = traceByRequestIdRef.current[update.requestId] || [];
      const nextTrace = [...previousTrace, update];
      traceByRequestIdRef.current[update.requestId] = nextTrace;

      const mappedConversationId = requestToConversationRef.current[update.requestId];
      const pending = resolvePendingClarificationFromUpdate(
        update,
        mappedConversationId,
        conversationIdRef.current
      );
      if (pending) {
        setPendingClarification(pending);
      }

      // Capture workspace path from early update events so it's available
      // before the chatSend promise resolves (users can click files during streaming).
      if (update.payload?.workspacePath && mappedConversationId) {
        workspaceByConversation.set(mappedConversationId, update.payload.workspacePath);
        if (mappedConversationId === conversationIdRef.current) {
          setWorkspacePath(update.payload.workspacePath);
        }
      }

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

  const sendMessage = useCallback(
    async (content: string, messageMode?: ChatMode) => {
      const requestId = makeRequestId();
      const userMessageId = `user-${Date.now()}`;
      const assistantMessageId = `assistant-${Date.now()}`;
      const effectiveMode = messageMode ?? options.mode ?? "default";

      // Create conversation if needed
      let currentConvId: string;
      if (conversationId) {
        currentConvId = conversationId;
      } else {
        try {
          const conv = await window.api.conversationCreate({
            model_profile_id: undefined
          });
          currentConvId = conv.id;
          setConversationId(currentConvId);
          upsertConversation(conv);
        } catch (error) {
          console.error("Failed to create conversation:", error);
          return;
        }
      }

      requestToConversationRef.current[requestId] = currentConvId;
      setConversationActiveRequest(currentConvId, requestId);
      setPendingClarification((previous) => {
        if (!previous) {
          return previous;
        }
        return previous.conversationId === currentConvId ? null : previous;
      });

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
        const historySource = [...messagesRef.current, userMessage].filter(
          (message) => !(message.role === "assistant" && message.requestId === requestId)
        );
        const history: ChatHistoryMessage[] = historySource.map((m) => ({
          role: m.role === "system" ? "system" : m.role,
          content: m.content
        }));

        // Call backend API
        const result = await window.api.chatSend({
          requestId,
          conversationId: currentConvId,
          message: content,
          history,
          mode: effectiveMode
        });

        // Capture workspace path for this conversation and persist to DB
        if (result.workspacePath) {
          workspaceByConversation.set(currentConvId, result.workspacePath);
          setWorkspacePath(result.workspacePath);
          window.api.conversationUpdate(currentConvId, { workspace_path: result.workspacePath }).catch(() => {});
        }

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

        const latestConversation = await window.api.conversationGet(currentConvId);
        if (latestConversation) {
          upsertConversation(latestConversation);
        }
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
        clearConversationRequestIfMatch(currentConvId, requestId);
      }
    },
    [clearConversationRequestIfMatch, conversationId, options.mode, setConversationActiveRequest, upsertConversation]
  );

  const cancelCurrentRequest = useCallback(async (): Promise<boolean> => {
    const currentConversationId = conversationIdRef.current;
    if (!currentConversationId) {
      return false;
    }

    const requestId = activeRequestByConversation[currentConversationId];
    if (!requestId) {
      return false;
    }

    try {
      const result = await window.api.chatCancel({ requestId });
      if (result.cancelled) {
        clearConversationRequestIfMatch(currentConversationId, requestId);
      }
      return result.cancelled;
    } catch (error) {
      console.error("Failed to cancel request:", error);
      return false;
    }
  }, [activeRequestByConversation, clearConversationRequestIfMatch]);

  const submitClarificationOption = useCallback(
    async (value: string) => {
      const normalized = normalizeClarificationInput(value);
      if (!normalized) {
        return;
      }
      await sendMessage(normalized);
      setPendingClarification(null);
    },
    [sendMessage]
  );

  const submitClarificationCustom = useCallback(
    async (value: string) => {
      const normalized = normalizeClarificationInput(value);
      if (!normalized) {
        return;
      }
      await sendMessage(normalized);
      setPendingClarification(null);
    },
    [sendMessage]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setPendingClarification(null);
    setActiveRequestByConversation({});
    traceByRequestIdRef.current = {};
    requestToConversationRef.current = {};
  }, []);

  return {
    messages,
    sendMessage,
    cancelCurrentRequest,
    submitClarificationOption,
    submitClarificationCustom,
    clearMessages,
    isLoading,
    conversationId,
    pendingClarification,
    workspacePath
  };
}

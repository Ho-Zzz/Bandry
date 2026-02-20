import { useCallback, useEffect, useRef, useState, type KeyboardEventHandler } from "react";
import type { ChatSendResult } from "../../../../shared/ipc";
import type { ChatMessage } from "../types";
import { createClientMessageId, formatChatUpdateLine, toChatHistory } from "../utils";

type UseChatSessionResult = {
  messages: ChatMessage[];
  input: string;
  sending: boolean;
  setInput: (value: string) => void;
  sendMessage: () => Promise<void>;
  onInputKeyDown: KeyboardEventHandler<HTMLTextAreaElement>;
};

const createPendingText = (trace: string[]): string => {
  const traceText = trace.join("\n");
  return traceText ? `正在执行工具与推理...\n\n${traceText}` : "正在执行工具与推理...";
};

const createResolvedText = (reply: string, trace: string[]): string => {
  if (trace.length === 0) {
    return reply;
  }
  return `执行过程:\n${trace.join("\n")}\n\n${reply}`;
};

const createErrorText = (message: string, trace: string[]): string => {
  const detail = `对话失败：${message}`;
  if (trace.length === 0) {
    return detail;
  }
  return `执行过程:\n${trace.join("\n")}\n\n${detail}`;
};

const mapCompletedMessage = (
  current: ChatMessage[],
  pendingMessageId: string,
  result: ChatSendResult,
  trace: string[]
): ChatMessage[] => {
  return current.map((item) => {
    if (item.id !== pendingMessageId) {
      return item;
    }

    return {
      ...item,
      content: createResolvedText(result.reply, trace),
      pending: false,
      meta: `${result.provider}/${result.model} · ${result.latencyMs}ms`
    };
  });
};

const mapFailedMessage = (
  current: ChatMessage[],
  pendingMessageId: string,
  errorMessage: string,
  trace: string[]
): ChatMessage[] => {
  return current.map((item) => {
    if (item.id !== pendingMessageId) {
      return item;
    }

    return {
      ...item,
      role: "system",
      content: createErrorText(errorMessage, trace),
      pending: false
    };
  });
};

export const useChatSession = (): UseChatSessionResult => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: createClientMessageId(),
      role: "assistant",
      content: "你好，我已经连接到 Bandry。直接告诉我任务，我会调用 DeepSeek 给出回复。",
      createdAt: Date.now()
    }
  ]);
  const [input, setInput] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);

  const requestToMessageRef = useRef<Map<string, string>>(new Map());
  const requestTraceRef = useRef<Map<string, string[]>>(new Map());

  useEffect(() => {
    const unsubscribe = window.api.onChatUpdate((update) => {
      const messageId = requestToMessageRef.current.get(update.requestId);
      if (!messageId) {
        return;
      }

      const currentTrace = requestTraceRef.current.get(update.requestId) ?? [];
      const nextTrace = [...currentTrace, formatChatUpdateLine(update)].slice(-12);
      requestTraceRef.current.set(update.requestId, nextTrace);

      setMessages((current) =>
        current.map((message) => {
          if (message.id !== messageId) {
            return message;
          }

          return {
            ...message,
            content: createPendingText(nextTrace)
          };
        })
      );
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const sendMessage = useCallback(async (): Promise<void> => {
    const text = input.trim();
    if (!text || sending) {
      return;
    }

    const history = toChatHistory(messages);
    const userMessage: ChatMessage = {
      id: createClientMessageId(),
      role: "user",
      content: text,
      createdAt: Date.now()
    };
    const pendingMessageId = createClientMessageId();
    const requestId = createClientMessageId();

    setMessages((current) => [
      ...current,
      userMessage,
      {
        id: pendingMessageId,
        role: "assistant",
        content: "正在请求 DeepSeek...",
        createdAt: Date.now(),
        pending: true
      }
    ]);
    setInput("");
    setSending(true);
    requestToMessageRef.current.set(requestId, pendingMessageId);
    requestTraceRef.current.set(requestId, []);

    try {
      const result = await window.api.chatSend({
        requestId,
        message: text,
        history
      });

      const trace = requestTraceRef.current.get(requestId) ?? [];
      setMessages((current) => mapCompletedMessage(current, pendingMessageId, result, trace));
    } catch (error) {
      const trace = requestTraceRef.current.get(requestId) ?? [];
      const errorMessage = error instanceof Error ? error.message : "请求失败";
      setMessages((current) => mapFailedMessage(current, pendingMessageId, errorMessage, trace));
    } finally {
      requestToMessageRef.current.delete(requestId);
      requestTraceRef.current.delete(requestId);
      setSending(false);
    }
  }, [input, messages, sending]);

  const onInputKeyDown = useCallback<KeyboardEventHandler<HTMLTextAreaElement>>(
    (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void sendMessage();
      }
    },
    [sendMessage]
  );

  return {
    messages,
    input,
    sending,
    setInput,
    sendMessage,
    onInputKeyDown
  };
};

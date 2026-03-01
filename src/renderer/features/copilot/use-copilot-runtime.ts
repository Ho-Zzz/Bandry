import { useCallback } from "react";
import {
  useExternalStoreRuntime,
  type AppendMessage,
  type MessageStatus as AssistantMessageStatus,
  type ThreadMessageLike
} from "@assistant-ui/react";
import type { ChatMode, ChatUpdateEvent } from "../../../shared/ipc";
import { useCopilotChat, type Message } from "./use-copilot-chat";

type UseCopilotRuntimeOptions = {
  conversationId?: string;
  mode?: ChatMode;
};

type TraceToolArgs = {
  stage: string;
  requestId: string;
};

type TraceToolResult = {
  message: string;
  timestamp: number;
  workspacePath?: string;
};

const toAssistantStatus = (status?: Message["status"]): AssistantMessageStatus | undefined => {
  if (status === "pending") {
    return { type: "running" };
  }

  if (status === "error") {
    return {
      type: "incomplete",
      reason: "error",
      error: "Assistant response failed"
    };
  }

  if (status === "completed") {
    return {
      type: "complete",
      reason: "stop"
    };
  }

  return undefined;
};

const buildTraceToolPart = (
  messageId: string,
  event: ChatUpdateEvent,
  index: number
): {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: TraceToolArgs;
  argsText: string;
  result: TraceToolResult;
  isError: boolean;
} => {
  return {
    type: "tool-call",
    toolCallId: `${messageId}-trace-${index}`,
    toolName: `trace_${event.stage}`,
    args: {
      stage: event.stage,
      requestId: event.requestId
    },
    argsText: JSON.stringify({ stage: event.stage }),
    result: {
      message: event.message,
      timestamp: event.timestamp,
      ...(event.payload?.workspacePath ? { workspacePath: event.payload.workspacePath } : {})
    },
    isError: event.stage === "error"
  };
};

const toAssistantContent = (message: Message): ThreadMessageLike["content"] => {
  const parts: Array<
    | {
        type: "text";
        text: string;
      }
    | ReturnType<typeof buildTraceToolPart>
  > = [];

  if (message.content.trim().length > 0) {
    parts.push({
      type: "text",
      text: message.content
    });
  }

  message.trace?.forEach((event, index) => {
    parts.push(buildTraceToolPart(message.id, event, index));
  });

  return parts;
};

const convertMessage = (message: Message): ThreadMessageLike => {
  if (message.role === "assistant") {
    return {
      id: message.id,
      role: "assistant",
      createdAt: new Date(message.timestamp),
      content: toAssistantContent(message),
      status: toAssistantStatus(message.status),
      metadata: {
        custom: {
          trace: message.trace ?? [],
          requestId: message.requestId ?? null,
          messageStatus: message.status ?? "completed"
        }
      }
    };
  }

  return {
    id: message.id,
    role: message.role,
    createdAt: new Date(message.timestamp),
    content: message.content
  };
};

const getTextFromAppendMessage = (message: AppendMessage): string => {
  const text = message.content
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }

      return "";
    })
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Only text messages are currently supported in Copilot.");
  }

  return text;
};

export const useCopilotRuntime = (options: UseCopilotRuntimeOptions = {}) => {
  const chat = useCopilotChat({
    conversationId: options.conversationId,
    mode: options.mode
  });

  const onNew = useCallback(
    async (message: AppendMessage): Promise<void> => {
      const content = getTextFromAppendMessage(message);
      await chat.sendMessage(content);
    },
    [chat]
  );

  const runtime = useExternalStoreRuntime<Message>({
    isRunning: chat.isLoading,
    messages: chat.messages,
    convertMessage,
    onNew
  });

  return {
    ...chat,
    runtime
  };
};

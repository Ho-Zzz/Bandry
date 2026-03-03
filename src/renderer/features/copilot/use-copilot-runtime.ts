import { useCallback, useMemo } from "react";
import {
  useExternalStoreRuntime,
  type AppendMessage,
  type AttachmentAdapter,
  type FeedbackAdapter,
  type MessageStatus as AssistantMessageStatus,
  type ThreadMessage,
  type ThreadMessageLike,
  type ThreadUserMessagePart
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

const parseTextFromAppendMessage = (message: AppendMessage): string => {
  return message.content
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }

      return "";
    })
    .join("\n")
    .trim();
};

const parseAttachmentSummary = (message: AppendMessage): string | null => {
  if (!message.attachments || message.attachments.length === 0) {
    return null;
  }

  const names = message.attachments.map((attachment) => attachment.name).filter(Boolean);
  if (names.length === 0) {
    return "Attached files";
  }

  return `Attached files: ${names.join(", ")}`;
};

const getTextFromAppendMessage = (message: AppendMessage): string => {
  const text = parseTextFromAppendMessage(message);
  if (text) {
    return text;
  }

  const attachmentSummary = parseAttachmentSummary(message);
  if (attachmentSummary) {
    return attachmentSummary;
  }

  throw new Error("Only text messages are currently supported in Copilot.");
};

const resolveAttachmentType = (file: File): "image" | "document" | "file" => {
  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("text/") || file.type === "application/pdf") {
    return "document";
  }

  return "file";
};

const makeAttachmentPart = (fileName: string): ThreadUserMessagePart[] => {
  return [
    {
      type: "text",
      text: `[Attachment] ${fileName}`
    }
  ];
};

const createAttachmentAdapter = (): AttachmentAdapter => {
  return {
    accept: "*/*",
    async add({ file }) {
      return {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: resolveAttachmentType(file),
        name: file.name,
        contentType: file.type || "application/octet-stream",
        file,
        status: {
          type: "requires-action",
          reason: "composer-send"
        }
      };
    },
    async remove() {
      return;
    },
    async send(attachment) {
      return {
        ...attachment,
        status: {
          type: "complete"
        },
        content: makeAttachmentPart(attachment.name)
      };
    }
  };
};

const createFeedbackAdapter = (): FeedbackAdapter => {
  return {
    submit: ({ message, type }: { message: ThreadMessage; type: "positive" | "negative" }) => {
      void message;
      void type;
    }
  };
};

const findReloadSeedText = (messages: Message[], parentId: string | null): string | null => {
  const fromIndex = parentId ? messages.findIndex((message) => message.id === parentId) : messages.length - 1;
  if (fromIndex < 0) {
    return null;
  }

  for (let index = fromIndex; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user" && message.content.trim().length > 0) {
      return message.content.trim();
    }
  }

  return null;
};

export const useCopilotRuntime = (options: UseCopilotRuntimeOptions = {}) => {
  const chat = useCopilotChat({
    conversationId: options.conversationId,
    mode: options.mode
  });

  const attachmentAdapter = useMemo(() => createAttachmentAdapter(), []);
  const feedbackAdapter = useMemo(() => createFeedbackAdapter(), []);

  const onNew = useCallback(
    async (message: AppendMessage): Promise<void> => {
      const content = getTextFromAppendMessage(message);
      await chat.sendMessage(content);
    },
    [chat]
  );

  const onEdit = useCallback(
    async (message: AppendMessage): Promise<void> => {
      const content = getTextFromAppendMessage(message);
      await chat.sendMessage(content);
    },
    [chat]
  );

  const onReload = useCallback(
    async (parentId: string | null): Promise<void> => {
      const content = findReloadSeedText(chat.messages, parentId);
      if (!content) {
        return;
      }

      await chat.sendMessage(content);
    },
    [chat]
  );

  const onCancel = useCallback(async (): Promise<void> => {
    await chat.cancelCurrentRequest();
  }, [chat]);

  const runtime = useExternalStoreRuntime<Message>({
    isRunning: chat.isLoading,
    messages: chat.messages,
    convertMessage,
    onNew,
    onEdit,
    onReload,
    onCancel,
    adapters: {
      attachments: attachmentAdapter,
      feedback: feedbackAdapter
    }
  });

  return {
    ...chat,
    runtime
  };
};

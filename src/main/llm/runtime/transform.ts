import type { ModelMessage as AiModelMessage, TextStreamPart, ToolSet } from "ai";
import type { ModelRequest, StreamEvent, StreamUsage } from "./schema";

export type ProviderRequest = {
  model: string;
  system?: string;
  messages: AiModelMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  providerOptions?: Record<string, Record<string, string | number | boolean | null>>;
};

export type ProviderTransformInput = Omit<ModelRequest, "modelId"> & {
  model: string;
};

export interface ITransform {
  request(input: ProviderTransformInput): ProviderRequest;
  response(part: TextStreamPart<ToolSet>): StreamEvent[];
}

const toUsage = (usage: {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  totalTokens: number | undefined;
}): StreamUsage | undefined => {
  if (usage.inputTokens === undefined && usage.outputTokens === undefined && usage.totalTokens === undefined) {
    return undefined;
  }

  return {
    promptTokens: usage.inputTokens,
    completionTokens: usage.outputTokens,
    totalTokens: usage.totalTokens
  };
};

const parseJsonMaybe = (raw: unknown): unknown => {
  if (typeof raw !== "string") {
    return raw;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return trimmed;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
};

const mapMessage = (
  message: ProviderTransformInput["messages"][number]
): AiModelMessage | null => {
  if (message.role === "system") {
    return null;
  }

  if (message.role === "tool") {
    const toolCallId = message.tool_call_id ? `tool_call_id=${message.tool_call_id} ` : "";
    return {
      role: "assistant",
      content: `[tool-result] ${toolCallId}${message.content}`
    } satisfies AiModelMessage;
  }

  if (message.role === "user") {
    return {
      role: "user",
      content: message.content
    } satisfies AiModelMessage;
  }

  return {
    role: "assistant",
    content: message.content
  } satisfies AiModelMessage;
};

export const openAiCompatibleTransform: ITransform = {
  request(input) {
    const system = input.messages
      .filter((message) => message.role === "system")
      .map((message) => message.content.trim())
      .filter(Boolean)
      .join("\n\n");

    const messages = input.messages
      .map(mapMessage)
      .filter((message): message is AiModelMessage => message !== null);

    const openaiOptions: Record<string, string | number | boolean | null> = {};
    if (input.frequencyPenalty !== undefined) {
      openaiOptions.frequencyPenalty = input.frequencyPenalty;
    }
    if (input.presencePenalty !== undefined) {
      openaiOptions.presencePenalty = input.presencePenalty;
    }

    const providerOptions =
      Object.keys(openaiOptions).length > 0
        ? {
            openai: openaiOptions
          }
        : undefined;

    return {
      model: input.model,
      system: system || undefined,
      messages,
      temperature: input.temperature,
      maxOutputTokens: input.maxTokens,
      topP: input.topP,
      topK: input.topK,
      presencePenalty: input.presencePenalty,
      frequencyPenalty: input.frequencyPenalty,
      stopSequences: input.stop,
      providerOptions
    };
  },
  response(part) {
    if (part.type === "text-delta") {
      return [
        {
          type: "content_delta",
          delta: part.text
        }
      ];
    }

    if (part.type === "tool-input-delta") {
      return [
        {
          type: "tool_call_delta",
          toolCallId: part.id,
          toolName: undefined,
          delta: part.delta
        }
      ];
    }

    if (part.type === "tool-call") {
      return [
        {
          type: "tool_call",
          toolCall: {
            id: part.toolCallId,
            name: part.toolName,
            arguments: parseJsonMaybe(part.input)
          }
        }
      ];
    }

    if (part.type === "finish") {
      return [
        {
          type: "finish",
          reason: part.finishReason,
          usage: toUsage(part.totalUsage)
        }
      ];
    }

    if (part.type === "error") {
      const message = part.error instanceof Error ? part.error.message : "Model stream error";
      return [
        {
          type: "error",
          error: message
        }
      ];
    }

    return [];
  }
};

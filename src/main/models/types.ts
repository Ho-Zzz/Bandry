import type { LlmProvider } from "../config";

export type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GenerateTextInput = {
  prompt?: string;
  messages?: LlmMessage[];
  systemPrompt?: string;
  provider?: LlmProvider;
  model?: string;
  runtimeConfig?: {
    provider: LlmProvider;
    baseUrl: string;
    apiKey: string;
    orgId?: string;
  };
  temperature?: number;
  maxTokens?: number;
  taskId?: string;
  abortSignal?: AbortSignal;
};

export type GenerateTextResult = {
  provider: LlmProvider;
  model: string;
  text: string;
  latencyMs: number;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

export type AuditRecord = {
  timestamp: string;
  provider: LlmProvider;
  model: string;
  success: boolean;
  latencyMs: number;
  status?: number;
  attempt: number;
  promptChars: number;
  responseChars?: number;
  error?: string;
  usage?: GenerateTextResult["usage"];
};

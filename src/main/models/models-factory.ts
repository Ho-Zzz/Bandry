import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig, LlmProvider } from "../config";
import { ModelRequestError } from "./model-request-error";
import { extractMessageText, getErrorMessage, isRetryableStatus } from "./openai-response-utils";
import { RateLimiter, sleep } from "./rate-limiter";
import type { AuditRecord, GenerateTextInput, GenerateTextResult, LlmMessage } from "./types";

type OpenAiLikeRequest = {
  model: string;
  messages: LlmMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
};

type ProviderResolvedConfig = {
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  orgId?: string;
};

export class ModelsFactory {
  private readonly rateLimiter: RateLimiter;

  constructor(private readonly config: AppConfig) {
    this.rateLimiter = new RateLimiter(config.llm.rateLimitRps);
  }

  isProviderConfigured(provider: LlmProvider): boolean {
    const providerConfig = this.config.providers[provider];
    return providerConfig.enabled && providerConfig.apiKey.trim().length > 0;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    const resolved = this.resolveProviderConfig(input);
    const messages = this.resolveMessages(input);
    const promptChars = messages.reduce((sum, message) => sum + message.content.length, 0);
    const requestPayload: OpenAiLikeRequest = {
      model: input.model?.trim() || resolved.model,
      messages,
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens
    };

    const startedAt = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.llm.maxRetries; attempt += 1) {
      try {
        await this.rateLimiter.waitTurn();
        const result = await this.requestOpenAiCompatible(resolved, requestPayload, input.abortSignal);
        const completed = {
          ...result,
          latencyMs: Date.now() - startedAt
        };

        await this.writeAuditRecord({
          timestamp: new Date().toISOString(),
          provider: resolved.provider,
          model: completed.model,
          success: true,
          latencyMs: completed.latencyMs,
          status: 200,
          attempt,
          promptChars,
          responseChars: completed.text.length,
          usage: completed.usage
        });

        return completed;
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error("Model request failed");
        lastError = normalized;
        const retryable = normalized instanceof ModelRequestError ? normalized.retryable : true;
        const status = normalized instanceof ModelRequestError ? normalized.status : undefined;

        await this.writeAuditRecord({
          timestamp: new Date().toISOString(),
          provider: resolved.provider,
          model: requestPayload.model,
          success: false,
          latencyMs: Date.now() - startedAt,
          status,
          attempt,
          promptChars,
          error: normalized.message
        });

        if (!retryable || attempt >= this.config.llm.maxRetries) {
          break;
        }

        const backoffMs = this.config.llm.retryBaseMs * 2 ** attempt;
        await sleep(backoffMs);
      }
    }

    throw lastError ?? new Error("Model request failed");
  }

  async generateTextStream(input: GenerateTextInput, onDelta: (delta: string) => void): Promise<GenerateTextResult> {
    const resolved = this.resolveProviderConfig(input);
    const messages = this.resolveMessages(input);
    const promptChars = messages.reduce((sum, message) => sum + message.content.length, 0);
    const requestPayload: OpenAiLikeRequest = {
      model: input.model?.trim() || resolved.model,
      messages,
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens,
      stream: true
    };

    const startedAt = Date.now();
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.llm.maxRetries; attempt += 1) {
      try {
        await this.rateLimiter.waitTurn();
        const result = await this.requestOpenAiCompatibleStream(
          resolved,
          requestPayload,
          onDelta,
          input.abortSignal
        );
        const completed = {
          ...result,
          latencyMs: Date.now() - startedAt
        };

        await this.writeAuditRecord({
          timestamp: new Date().toISOString(),
          provider: resolved.provider,
          model: completed.model,
          success: true,
          latencyMs: completed.latencyMs,
          status: 200,
          attempt,
          promptChars,
          responseChars: completed.text.length,
          usage: completed.usage
        });

        return completed;
      } catch (error) {
        const normalized = error instanceof Error ? error : new Error("Model request failed");
        lastError = normalized;
        const retryable = normalized instanceof ModelRequestError ? normalized.retryable : true;
        const status = normalized instanceof ModelRequestError ? normalized.status : undefined;

        await this.writeAuditRecord({
          timestamp: new Date().toISOString(),
          provider: resolved.provider,
          model: requestPayload.model,
          success: false,
          latencyMs: Date.now() - startedAt,
          status,
          attempt,
          promptChars,
          error: normalized.message
        });

        if (!retryable || attempt >= this.config.llm.maxRetries) {
          break;
        }

        const backoffMs = this.config.llm.retryBaseMs * 2 ** attempt;
        await sleep(backoffMs);
      }
    }

    throw lastError ?? new Error("Model request failed");
  }

  private resolveProviderConfig(input: GenerateTextInput): ProviderResolvedConfig {
    if (input.runtimeConfig) {
      const runtime = input.runtimeConfig;
      const runtimeApiKey = runtime.apiKey.trim();
      if (!runtimeApiKey) {
        throw new Error(`Provider ${runtime.provider} is not configured`);
      }

      return {
        provider: runtime.provider,
        baseUrl: runtime.baseUrl,
        apiKey: runtimeApiKey,
        model: input.model?.trim() || this.config.providers[runtime.provider].model,
        orgId: runtime.orgId
      };
    }

    const provider = input.provider ?? this.config.llm.defaultProvider;
    const providerConfig = this.config.providers[provider];

    if (!providerConfig.enabled) {
      throw new Error(`Provider ${provider} is disabled`);
    }

    if (!providerConfig.apiKey.trim()) {
      throw new Error(`Provider ${provider} is not configured`);
    }

    return {
      provider,
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      model: providerConfig.model,
      orgId: providerConfig.orgId
    };
  }

  private resolveMessages(input: GenerateTextInput): LlmMessage[] {
    if (input.messages && input.messages.length > 0) {
      const normalized = input.messages
        .map((message) => ({
          role: message.role,
          content: String(message.content ?? "").trim()
        }))
        .filter((message) => Boolean(message.content));

      if (normalized.length > 0) {
        return normalized;
      }
    }

    const prompt = input.prompt?.trim();
    if (!prompt) {
      throw new Error("Either prompt or messages is required");
    }

    return [
      ...(input.systemPrompt ? [{ role: "system", content: input.systemPrompt } satisfies LlmMessage] : []),
      { role: "user", content: prompt }
    ];
  }

  private async requestOpenAiCompatible(
    provider: ProviderResolvedConfig,
    payload: OpenAiLikeRequest,
    externalSignal?: AbortSignal
  ): Promise<Omit<GenerateTextResult, "latencyMs">> {
    const endpoint = `${provider.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), this.config.llm.timeoutMs);
    const signal = externalSignal
      ? AbortSignal.any([timeoutController.signal, externalSignal])
      : timeoutController.signal;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`
      };
      if (provider.provider === "openai" && provider.orgId) {
        headers["OpenAI-Organization"] = provider.orgId;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal
      });

      let json: unknown;
      try {
        json = await response.json();
      } catch {
        throw new ModelRequestError("Model response is not valid JSON", {
          status: response.status,
          retryable: isRetryableStatus(response.status)
        });
      }

      if (!response.ok) {
        throw new ModelRequestError(getErrorMessage(json), {
          status: response.status,
          retryable: isRetryableStatus(response.status)
        });
      }

      const parsed = json as {
        choices?: Array<{ message?: { content?: unknown } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      const text = extractMessageText(parsed.choices?.[0]?.message?.content);
      if (!text) {
        throw new ModelRequestError("Model returned empty content", {
          status: response.status,
          retryable: false
        });
      }

      return {
        provider: provider.provider,
        model: payload.model,
        text,
        usage: parsed.usage
          ? {
              promptTokens: parsed.usage.prompt_tokens,
              completionTokens: parsed.usage.completion_tokens,
              totalTokens: parsed.usage.total_tokens
            }
          : undefined
      };
    } catch (error) {
      if (error instanceof ModelRequestError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        if (externalSignal?.aborted) {
          throw new ModelRequestError("Model request cancelled by user", {
            retryable: false
          });
        }

        throw new ModelRequestError(`Model request timed out after ${this.config.llm.timeoutMs}ms`, {
          retryable: true
        });
      }

      const message = error instanceof Error ? error.message : "Network error";
      throw new ModelRequestError(message, { retryable: true });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestOpenAiCompatibleStream(
    provider: ProviderResolvedConfig,
    payload: OpenAiLikeRequest,
    onDelta: (delta: string) => void,
    externalSignal?: AbortSignal
  ): Promise<Omit<GenerateTextResult, "latencyMs">> {
    const endpoint = `${provider.baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const timeoutController = new AbortController();
    const timeout = setTimeout(() => timeoutController.abort(), this.config.llm.timeoutMs);
    const signal = externalSignal
      ? AbortSignal.any([timeoutController.signal, externalSignal])
      : timeoutController.signal;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`
      };
      if (provider.provider === "openai" && provider.orgId) {
        headers["OpenAI-Organization"] = provider.orgId;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...payload,
          stream: true
        }),
        signal
      });

      if (!response.ok) {
        const raw = await response.text();
        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          json = raw;
        }

        throw new ModelRequestError(getErrorMessage(json), {
          status: response.status,
          retryable: isRetryableStatus(response.status)
        });
      }

      if (!response.body) {
        throw new ModelRequestError("Model response stream is empty", {
          status: response.status,
          retryable: isRetryableStatus(response.status)
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let fullText = "";
      let usage: GenerateTextResult["usage"];

      const emitDelta = async (value: string): Promise<void> => {
        if (!value) {
          return;
        }

        // Some providers return one giant delta chunk at the end; split it
        // to keep renderer updates incremental and visibly streaming.
        const shouldSlice = value.length >= 160;
        if (!shouldSlice) {
          onDelta(value);
          return;
        }

        const sliceSize = 56;
        for (let index = 0; index < value.length; index += sliceSize) {
          const chunk = value.slice(index, index + sliceSize);
          onDelta(chunk);
          await sleep(8);
        }
      };

      const consumeSseLine = async (line: string): Promise<void> => {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) {
          return;
        }

        const raw = trimmed.slice(5).trim();
        if (!raw || raw === "[DONE]") {
          return;
        }

        let parsed: {
          choices?: Array<{
            delta?: {
              content?: unknown;
            };
          }>;
          usage?: {
            prompt_tokens?: number;
            completion_tokens?: number;
            total_tokens?: number;
          };
        };

        try {
          parsed = JSON.parse(raw) as typeof parsed;
        } catch {
          return;
        }

        const deltaText = extractMessageText(parsed.choices?.[0]?.delta?.content);
        if (deltaText) {
          fullText += deltaText;
          await emitDelta(deltaText);
        }

        if (parsed.usage) {
          usage = {
            promptTokens: parsed.usage.prompt_tokens,
            completionTokens: parsed.usage.completion_tokens,
            totalTokens: parsed.usage.total_tokens
          };
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          await consumeSseLine(line);
          newlineIndex = buffer.indexOf("\n");
        }
      }

      const remaining = buffer.trim();
      if (remaining) {
        await consumeSseLine(remaining);
      }

      if (!fullText) {
        throw new ModelRequestError("Model returned empty content", {
          status: response.status,
          retryable: false
        });
      }

      return {
        provider: provider.provider,
        model: payload.model,
        text: fullText,
        usage
      };
    } catch (error) {
      if (error instanceof ModelRequestError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        if (externalSignal?.aborted) {
          throw new ModelRequestError("Model request cancelled by user", {
            retryable: false
          });
        }

        throw new ModelRequestError(`Model request timed out after ${this.config.llm.timeoutMs}ms`, {
          retryable: true
        });
      }

      const message = error instanceof Error ? error.message : "Network error";
      throw new ModelRequestError(message, { retryable: true });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async writeAuditRecord(record: AuditRecord): Promise<void> {
    if (!this.config.llm.auditLogEnabled) {
      return;
    }

    const filePath = this.config.paths.auditLogPath;
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, "utf8");
  }
}

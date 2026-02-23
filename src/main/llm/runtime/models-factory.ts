import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig, LlmProvider } from "../../config";
import { ModelService } from "./model-service";
import { ModelRequestError } from "./model-request-error";
import type { AuditRecord, GenerateTextInput, GenerateTextResult, LlmMessage } from "./types";

type ProviderResolvedConfig = {
  provider: LlmProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  orgId?: string;
};

export class ModelsFactory {
  private readonly modelService: ModelService;

  constructor(private readonly config: AppConfig) {
    this.modelService = new ModelService(config);
  }

  isProviderConfigured(provider: LlmProvider): boolean {
    const providerConfig = this.config.providers[provider];
    return providerConfig.enabled && providerConfig.apiKey.trim().length > 0;
  }

  async generateText(input: GenerateTextInput): Promise<GenerateTextResult> {
    return this.generateInternal(input);
  }

  async generateTextStream(input: GenerateTextInput, onDelta: (delta: string) => void): Promise<GenerateTextResult> {
    return this.generateInternal(input, onDelta);
  }

  private async generateInternal(
    input: GenerateTextInput,
    onDelta?: (delta: string) => void
  ): Promise<GenerateTextResult> {
    const resolved = this.resolveProviderConfig(input);
    const model = input.model?.trim() || resolved.model;
    const messages = this.resolveMessages(input);
    const promptChars = messages.reduce((sum, message) => sum + message.content.length, 0);
    const startedAt = Date.now();

    try {
      const stream = this.modelService.chat({
        modelId: `${resolved.provider}:${model}`,
        messages,
        temperature: input.temperature ?? 0.2,
        maxTokens: input.maxTokens,
        runtimeConfig: {
          provider: resolved.provider,
          baseUrl: resolved.baseUrl,
          apiKey: resolved.apiKey,
          orgId: resolved.orgId
        },
        abortSignal: input.abortSignal
      });

      let text = "";
      let usage: GenerateTextResult["usage"];

      for await (const event of stream) {
        if (event.type === "content_delta") {
          text += event.delta;
          onDelta?.(event.delta);
          continue;
        }

        if (event.type === "finish") {
          usage = event.usage
            ? {
                promptTokens: event.usage.promptTokens,
                completionTokens: event.usage.completionTokens,
                totalTokens: event.usage.totalTokens
              }
            : undefined;
          continue;
        }

        if (event.type === "error") {
          throw new ModelRequestError(event.error, {
            retryable: false
          });
        }
      }

      if (!text) {
        throw new ModelRequestError("Model returned empty content", {
          retryable: false
        });
      }

      const completed: GenerateTextResult = {
        provider: resolved.provider,
        model,
        text,
        latencyMs: Date.now() - startedAt,
        usage
      };

      await this.writeAuditRecord({
        timestamp: new Date().toISOString(),
        provider: resolved.provider,
        model: completed.model,
        success: true,
        latencyMs: completed.latencyMs,
        status: 200,
        attempt: 0,
        promptChars,
        responseChars: completed.text.length,
        usage: completed.usage
      });

      return completed;
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error("Model request failed");
      const status = normalized instanceof ModelRequestError ? normalized.status : undefined;

      await this.writeAuditRecord({
        timestamp: new Date().toISOString(),
        provider: resolved.provider,
        model,
        success: false,
        latencyMs: Date.now() - startedAt,
        status,
        attempt: 0,
        promptChars,
        error: normalized.message
      });

      throw normalized;
    }
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

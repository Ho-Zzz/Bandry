import pino from "pino";
import * as PQueueModule from "p-queue";
import type PQueue from "p-queue";
import type { AppConfig, LlmProvider } from "../config";
import {
  ModelRequestSchema,
  ProviderRuntimeConfigSchema,
  StreamEventSchema,
  type ModelRequest,
  type ProviderRuntimeConfig,
  type StreamEvent
} from "./schema";
import type { ProviderExecuteInput } from "./providers/base.provider";
import { providerRegistry } from "./providers/_registry";

type PQueueConstructor = new (...args: unknown[]) => PQueue;

const isConstructable = (value: unknown): value is PQueueConstructor => {
  if (typeof value !== "function") {
    return false;
  }

  try {
    Reflect.construct(String, [], value);
    return true;
  } catch {
    return false;
  }
};

const resolvePQueueConstructorCandidate = (
  value: unknown,
  depth = 0
): PQueueConstructor | null => {
  if (isConstructable(value)) {
    return value;
  }

  if (depth >= 4 || typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as {
    default?: unknown;
  };
  if (record.default === undefined) {
    return null;
  }

  return resolvePQueueConstructorCandidate(record.default, depth + 1);
};

const resolvePQueueConstructor = (): PQueueConstructor => {
  const resolved = resolvePQueueConstructorCandidate(PQueueModule);
  if (resolved) {
    return resolved;
  }

  throw new Error("Failed to resolve p-queue constructor");
};

const PQueueConstructor = resolvePQueueConstructor();

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Model request failed";
};

const buildRateQueue = (rateLimitRps: number): PQueue => {
  const safeRate = Math.max(0.1, rateLimitRps);
  const interval = Math.max(1, Math.round(1000 / safeRate));

  return new PQueueConstructor({
    concurrency: 1,
    intervalCap: 1,
    interval,
    carryoverConcurrencyCount: true
  });
};

const parseModelId = (
  modelId: string,
  fallbackProvider: string
): { providerId: string; model: string } => {
  const delimiter = modelId.indexOf(":");
  if (delimiter <= 0) {
    return {
      providerId: fallbackProvider,
      model: modelId
    };
  }

  const providerId = modelId.slice(0, delimiter).trim();
  const model = modelId.slice(delimiter + 1).trim();
  if (!providerId || !model) {
    return {
      providerId: fallbackProvider,
      model: modelId
    };
  }

  return { providerId, model };
};

export type ModelServiceInput = ModelRequest & {
  runtimeConfig?: ProviderRuntimeConfig;
  abortSignal?: AbortSignal;
};

export class ModelService {
  private readonly logger = pino({
    name: "model-service"
  });

  private readonly queues = new Map<string, PQueue>();

  constructor(private readonly config: AppConfig) {}

  async *chat(input: ModelServiceInput): AsyncIterable<StreamEvent> {
    const request = ModelRequestSchema.parse(input);
    const runtimeConfig = input.runtimeConfig
      ? ProviderRuntimeConfigSchema.parse(input.runtimeConfig)
      : undefined;

    const parsedModel = parseModelId(
      request.modelId,
      runtimeConfig?.provider ?? this.config.llm.defaultProvider
    );

    const provider = providerRegistry.get(parsedModel.providerId);
    if (!provider) {
      yield {
        type: "error",
        error: `Provider not found for model: ${request.modelId}`
      };
      return;
    }

    let resolvedRuntime: ProviderRuntimeConfig;
    try {
      resolvedRuntime = this.resolveRuntimeConfig(parsedModel.providerId, runtimeConfig);
    } catch (error) {
      yield {
        type: "error",
        error: getErrorMessage(error)
      };
      return;
    }
    if (!resolvedRuntime.apiKey.trim()) {
      yield {
        type: "error",
        error: `Provider ${parsedModel.providerId} is not configured`
      };
      return;
    }

    const providerInput: ProviderExecuteInput = {
      model: parsedModel.model,
      messages: request.messages,
      tools: request.tools,
      temperature: request.temperature,
      maxTokens: request.maxTokens,
      topP: request.topP,
      topK: request.topK,
      presencePenalty: request.presencePenalty,
      frequencyPenalty: request.frequencyPenalty,
      stop: request.stop
    };

    const queue = this.getQueue(parsedModel.providerId);

    try {
      for await (const event of provider.execute(providerInput, {
        providerId: parsedModel.providerId,
        runtimeConfig: resolvedRuntime,
        timeoutMs: this.config.llm.timeoutMs,
        maxRetries: this.config.llm.maxRetries,
        retryBaseMs: this.config.llm.retryBaseMs,
        queue,
        logger: this.logger,
        abortSignal: input.abortSignal
      })) {
        const parsedEvent = StreamEventSchema.parse(event);
        yield parsedEvent;
      }
    } catch (error) {
      this.logger.error(
        {
          provider: parsedModel.providerId,
          model: parsedModel.model,
          error: getErrorMessage(error)
        },
        "model service request failed"
      );

      yield {
        type: "error",
        error: getErrorMessage(error)
      };
    }
  }

  private getQueue(providerId: string): PQueue {
    const existing = this.queues.get(providerId);
    if (existing) {
      return existing;
    }

    const queue = buildRateQueue(this.config.llm.rateLimitRps);
    this.queues.set(providerId, queue);
    return queue;
  }

  private resolveRuntimeConfig(
    providerId: string,
    runtimeConfig?: ProviderRuntimeConfig
  ): ProviderRuntimeConfig {
    if (runtimeConfig) {
      if (runtimeConfig.provider !== providerId) {
        throw new Error(
          `Model provider mismatch: modelId requires ${providerId} but runtimeConfig is ${runtimeConfig.provider}`
        );
      }

      return {
        provider: runtimeConfig.provider,
        baseUrl: runtimeConfig.baseUrl,
        apiKey: runtimeConfig.apiKey,
        orgId: runtimeConfig.orgId
      };
    }

    if (!(providerId in this.config.providers)) {
      throw new Error(
        `Provider ${providerId} must be supplied via runtimeConfig`
      );
    }

    const providerKey = providerId as LlmProvider;
    const providerConfig = this.config.providers[providerKey];

    return {
      provider: providerKey,
      baseUrl: providerConfig.baseUrl,
      apiKey: providerConfig.apiKey,
      orgId: providerConfig.orgId
    };
  }
}

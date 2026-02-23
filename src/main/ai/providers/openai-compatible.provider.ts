import { streamText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import pRetry from "p-retry";
import type { IProvider, ProviderExecuteInput, ProviderExecutionContext } from "./base.provider";
import { toStreamEvents } from "../stream";
import { openAiCompatibleTransform, type ITransform } from "../transform";
import type { StreamEvent } from "../schema";

const resolvePRetry = (): typeof pRetry => {
  if (typeof pRetry === "function") {
    return pRetry;
  }

  const candidate = pRetry as unknown as {
    default?: typeof pRetry;
  };
  if (candidate.default && typeof candidate.default === "function") {
    return candidate.default;
  }

  throw new Error("Failed to resolve p-retry function");
};

const pRetryFn = resolvePRetry();

const getErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const record = error as Record<string, unknown>;
  if (typeof record.statusCode === "number") {
    return record.statusCode;
  }

  if (typeof record.status === "number") {
    return record.status;
  }

  if (typeof record.response === "object" && record.response !== null) {
    const responseRecord = record.response as Record<string, unknown>;
    if (typeof responseRecord.status === "number") {
      return responseRecord.status;
    }
  }

  return undefined;
};

const isRetryableError = (error: unknown): boolean => {
  if (error instanceof Error && error.name === "AbortError") {
    return false;
  }

  const status = getErrorStatus(error);
  if (status === 429) {
    return true;
  }

  if (typeof status === "number") {
    return status >= 500;
  }

  return true;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Model request failed";
};

export class OpenAiCompatibleProvider implements IProvider {
  readonly id: string;

  constructor(id: string, private readonly transform: ITransform = openAiCompatibleTransform) {
    this.id = id;
  }

  async *execute(
    input: ProviderExecuteInput,
    context: ProviderExecutionContext
  ): AsyncIterable<StreamEvent> {
    const prepared = this.transform.request(input);

    const client = createOpenAI({
      apiKey: context.runtimeConfig.apiKey,
      baseURL: context.runtimeConfig.baseUrl,
      organization: context.runtimeConfig.orgId
    });

    const model = client.chat(prepared.model);

    let streamResult: ReturnType<typeof streamText>;

    try {
      streamResult = await pRetryFn(
        async (attemptNumber) => {
          context.logger.info(
            {
              provider: this.id,
              model: prepared.model,
              attempt: attemptNumber
            },
            "model request start"
          );

          return context.queue.add(async () => {
            return streamText({
              model,
              system: prepared.system,
              messages: prepared.messages,
              temperature: prepared.temperature,
              maxOutputTokens: prepared.maxOutputTokens,
              topP: prepared.topP,
              topK: prepared.topK,
              presencePenalty: prepared.presencePenalty,
              frequencyPenalty: prepared.frequencyPenalty,
              stopSequences: prepared.stopSequences,
              providerOptions: prepared.providerOptions,
              timeout: context.timeoutMs,
              maxRetries: 0,
              abortSignal: context.abortSignal
            });
          });
        },
        {
          retries: context.maxRetries,
          factor: 2,
          minTimeout: context.retryBaseMs,
          shouldRetry: ({ error }) => {
            if (context.abortSignal?.aborted) {
              return false;
            }

            return isRetryableError(error);
          },
          onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
            context.logger.warn(
              {
                provider: this.id,
                model: prepared.model,
                attempt: attemptNumber,
                retriesLeft,
                error: getErrorMessage(error)
              },
              "model request attempt failed"
            );
          }
        }
      );
    } catch (error) {
      const message = getErrorMessage(error);
      context.logger.error(
        {
          provider: this.id,
          model: prepared.model,
          error: message
        },
        "model request failed before stream consumption"
      );

      yield {
        type: "error",
        error: message
      };
      return;
    }

    try {
      for await (const event of toStreamEvents(streamResult.fullStream, this.transform)) {
        yield event;
      }
    } catch (error) {
      const message = getErrorMessage(error);
      context.logger.error(
        {
          provider: this.id,
          model: prepared.model,
          error: message
        },
        "model stream failed"
      );

      yield {
        type: "error",
        error: message
      };
    }
  }
}

import type { Logger } from "pino";
import type PQueue from "p-queue";
import type { ModelRequest, ProviderRuntimeConfig, StreamEvent } from "../runtime/schema";

export type ProviderExecuteInput = Omit<ModelRequest, "modelId"> & {
  model: string;
};

export type ProviderExecutionContext = {
  providerId: string;
  runtimeConfig: ProviderRuntimeConfig;
  timeoutMs: number;
  maxRetries: number;
  retryBaseMs: number;
  queue: PQueue;
  logger: Logger;
  abortSignal?: AbortSignal;
};

export interface IProvider {
  readonly id: string;
  execute(input: ProviderExecuteInput, context: ProviderExecutionContext): AsyncIterable<StreamEvent>;
}

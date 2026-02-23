import type { AppConfig } from "../../../config";
import { DAGScheduler } from "./scheduler";
import { WorkerPool } from "./workers";
import type { DAGPlan, AgentResult } from "./agents";

export type DelegationEvent =
  | { type: "task_started"; taskId: string }
  | { type: "task_progress"; taskId: string; message: string; progress?: number }
  | { type: "task_completed"; taskId: string; result: AgentResult }
  | { type: "task_failed"; taskId: string; error: string }
  | { type: "aborted" };

export type DelegationEngineOptions = {
  maxWorkers?: number;
};

export class DelegationEngine {
  private readonly workerPool: WorkerPool;
  private readonly scheduler: DAGScheduler;

  constructor(options: DelegationEngineOptions = {}) {
    this.workerPool = new WorkerPool(options.maxWorkers ?? 3);
    this.scheduler = new DAGScheduler(this.workerPool);
  }

  async execute(input: {
    plan: DAGPlan;
    workspacePath: string;
    appConfig: AppConfig;
    abortSignal?: AbortSignal;
    onEvent?: (event: DelegationEvent) => void;
  }): Promise<Map<string, AgentResult>> {
    const { abortSignal, onEvent } = input;

    const onStarted = (taskId: string) => onEvent?.({ type: "task_started", taskId });
    const onCompleted = (taskId: string, result: AgentResult) =>
      onEvent?.({ type: "task_completed", taskId, result });
    const onProgress = (taskId: string, message: string, progress?: number) =>
      onEvent?.({ type: "task_progress", taskId, message, progress });
    const onFailed = (taskId: string, error: string) =>
      onEvent?.({ type: "task_failed", taskId, error });

    this.scheduler.on("task:started", onStarted);
    this.scheduler.on("task:progress", onProgress);
    this.scheduler.on("task:completed", onCompleted);
    this.scheduler.on("task:failed", onFailed);

    let aborted = false;
    const abortHandler = (): void => {
      aborted = true;
      onEvent?.({ type: "aborted" });
      void this.workerPool.terminateAll();
    };

    abortSignal?.addEventListener("abort", abortHandler, { once: true });

    try {
      if (abortSignal?.aborted) {
        throw new Error("Request cancelled by user");
      }

      const result = await this.scheduler.scheduleDAG(
        input.plan,
        input.workspacePath,
        input.appConfig,
        () => aborted || Boolean(abortSignal?.aborted)
      );

      if (aborted || abortSignal?.aborted) {
        throw new Error("Request cancelled by user");
      }

      return result;
    } finally {
      abortSignal?.removeEventListener("abort", abortHandler);
      this.scheduler.off("task:started", onStarted);
      this.scheduler.off("task:progress", onProgress);
      this.scheduler.off("task:completed", onCompleted);
      this.scheduler.off("task:failed", onFailed);
      await this.workerPool.terminateAll();
      this.scheduler.clear();
    }
  }
}

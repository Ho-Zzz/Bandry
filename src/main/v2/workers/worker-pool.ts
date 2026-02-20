import { Worker } from "worker_threads";
import * as path from "path";
import type { WorkerConfig, AgentResult, WorkerMessage } from "../agents/types";

/**
 * Worker pool
 * Manages worker threads for sub-agent execution
 */
export class WorkerPool {
  private workers: Map<string, Worker> = new Map();
  private maxWorkers: number;

  constructor(maxWorkers: number = 3) {
    this.maxWorkers = maxWorkers;
  }

  /**
   * Execute a task in a worker thread
   */
  async executeTask(config: WorkerConfig): Promise<AgentResult> {
    // Check worker limit
    if (this.workers.size >= this.maxWorkers) {
      throw new Error(`Worker pool limit reached (${this.maxWorkers})`);
    }

    return new Promise((resolve, reject) => {
      // Create worker
      const workerPath = path.join(__dirname, "sub-agent-worker.cjs");
      const worker = new Worker(workerPath, {
        workerData: config
      });

      this.workers.set(config.workerId, worker);

      // Handle messages from worker
      worker.on("message", (message: WorkerMessage) => {
        if (message.type === "completed") {
          this.terminateWorker(config.workerId);
          resolve(message.result);
        } else if (message.type === "failed") {
          this.terminateWorker(config.workerId);
          reject(new Error(message.error));
        } else if (message.type === "progress") {
          // Emit progress event (can be listened to by scheduler)
          this.emit("progress", config.workerId, message.message, message.progress);
        }
      });

      // Handle worker errors
      worker.on("error", (error) => {
        this.terminateWorker(config.workerId);
        reject(error);
      });

      // Handle worker exit
      worker.on("exit", (code) => {
        if (code !== 0) {
          this.terminateWorker(config.workerId);
          reject(new Error(`Worker exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Terminate a worker
   */
  async terminateWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (worker) {
      await worker.terminate();
      this.workers.delete(workerId);
    }
  }

  /**
   * Terminate all workers
   */
  async terminateAll(): Promise<void> {
    const promises = Array.from(this.workers.keys()).map((id) =>
      this.terminateWorker(id)
    );
    await Promise.all(promises);
  }

  /**
   * Get active worker count
   */
  getActiveWorkerCount(): number {
    return this.workers.size;
  }

  /**
   * Get worker IDs
   */
  getWorkerIds(): string[] {
    return Array.from(this.workers.keys());
  }

  /**
   * Simple event emitter for progress updates
   */
  private listeners: Map<string, Array<(...args: any[]) => void>> = new Map();

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  private emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        listener(...args);
      }
    }
  }
}

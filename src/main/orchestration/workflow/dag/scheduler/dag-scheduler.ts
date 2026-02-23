import { EventEmitter } from "events";
import type { DAGPlan, TaskNode, AgentResult } from "../agents/types";
import type { WorkerPool } from "../workers/worker-pool";
import type { AppConfig } from "../../../../config";

/**
 * DAG Scheduler
 * Manages task dependencies and execution order
 */
export class DAGScheduler extends EventEmitter {
  private taskGraph: Map<string, TaskNode> = new Map();
  private readonly workerProgressListener: (workerId: unknown, message: unknown, progress: unknown) => void;

  constructor(private workerPool: WorkerPool) {
    super();
    this.workerProgressListener = (workerId: unknown, message: unknown, progress: unknown) => {
      if (typeof workerId !== "string" || typeof message !== "string") {
        return;
      }
      this.emit("task:progress", workerId, message, typeof progress === "number" ? progress : undefined);
    };
    if (typeof this.workerPool.on === "function") {
      this.workerPool.on("progress", this.workerProgressListener);
    }
  }

  /**
   * Schedule a DAG plan for execution
   */
  async scheduleDAG(
    plan: DAGPlan,
    workspacePath: string,
    appConfig: AppConfig,
    shouldAbort?: () => boolean
  ): Promise<Map<string, AgentResult>> {
    // Build task graph
    this.buildTaskGraph(plan);

    // Start execution
    await this.executeDAG(workspacePath, appConfig, shouldAbort);

    // Collect results
    const results = new Map<string, AgentResult>();
    for (const [taskId, node] of this.taskGraph.entries()) {
      if (node.result) {
        results.set(taskId, node.result);
      }
    }

    return results;
  }

  /**
   * Build dependency graph from plan
   */
  private buildTaskGraph(plan: DAGPlan): void {
    this.taskGraph.clear();

    for (const task of plan.tasks) {
      this.taskGraph.set(task.subTaskId, {
        task,
        status: "pending"
      });
    }

    // Validate dependencies
    for (const task of plan.tasks) {
      for (const depId of task.dependencies) {
        if (!this.taskGraph.has(depId)) {
          throw new Error(`Invalid dependency: ${depId} not found in task graph`);
        }
      }
    }
  }

  /**
   * Execute DAG with dependency resolution
   */
  private async executeDAG(
    workspacePath: string,
    appConfig: AppConfig,
    shouldAbort?: () => boolean
  ): Promise<void> {
    const successful = new Set<string>();
    const failed = new Set<string>();
    const executing = new Map<string, Promise<void>>();

    while (successful.size + failed.size < this.taskGraph.size) {
      if (shouldAbort?.()) {
        throw new Error("Delegation aborted");
      }

      this.markBlockedTasks(failed);

      const availableSlots = this.workerPool.getAvailableSlots();
      if (availableSlots > 0) {
        const readyTasks = this.getReadyTasks(successful).slice(0, availableSlots);
        for (const taskId of readyTasks) {
          const promise = this.executeTask(taskId, workspacePath, appConfig, successful, failed).finally(() => {
            executing.delete(taskId);
          });
          executing.set(taskId, promise);
        }
      }

      if (successful.size + failed.size >= this.taskGraph.size) {
        break;
      }

      if (executing.size === 0) {
        const pendingTasks = Array.from(this.taskGraph.values())
          .filter((node) => node.status === "pending")
          .map((node) => node.task.subTaskId);
        if (pendingTasks.length > 0) {
          throw new Error(`Circular dependency detected or no runnable tasks: ${pendingTasks.join(", ")}`);
        }
        break;
      }

      await Promise.race(executing.values());
    }
  }

  /**
   * Get tasks that are ready to execute
   */
  private getReadyTasks(completed: Set<string>): string[] {
    const ready: string[] = [];

    for (const [taskId, node] of this.taskGraph.entries()) {
      if (node.status !== "pending") continue;

      // Check if all dependencies are completed
      const allDepsCompleted = node.task.dependencies.every((depId) =>
        completed.has(depId)
      );

      if (allDepsCompleted) {
        ready.push(taskId);
      }
    }

    return ready;
  }

  private markBlockedTasks(failed: Set<string>): void {
    for (const [taskId, node] of this.taskGraph.entries()) {
      if (node.status !== "pending") {
        continue;
      }

      const blockedBy = node.task.dependencies.filter((depId) => failed.has(depId));
      if (blockedBy.length === 0) {
        continue;
      }

      node.status = "failed";
      node.completedAt = Date.now();
      node.result = {
        success: false,
        output: "",
        error: `Blocked by failed dependencies: ${blockedBy.join(", ")}`
      };
      failed.add(taskId);
      this.emit("task:failed", taskId, node.result.error);
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    taskId: string,
    workspacePath: string,
    appConfig: AppConfig,
    successful: Set<string>,
    failed: Set<string>
  ): Promise<void> {
    const node = this.taskGraph.get(taskId)!;
    node.status = "running";
    node.startedAt = Date.now();

    this.emit("task:started", taskId, node.task);

    try {
      // Spawn worker for this task
      const result = await this.workerPool.executeTask({
        workerId: taskId,
        agentRole: node.task.agentRole,
        prompt: node.task.prompt,
        workspacePath,
        allowedTools: this.getToolsForRole(node.task.agentRole),
        writePath: node.task.writePath,
        appConfig
      });

      node.status = "completed";
      node.result = result;
      node.completedAt = Date.now();
      successful.add(taskId);

      this.emit("task:completed", taskId, result);
    } catch (error) {
      node.status = "failed";
      node.result = {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error)
      };
      node.completedAt = Date.now();
      failed.add(taskId);

      this.emit("task:failed", taskId, node.result.error);
    }
  }

  /**
   * Get tools for agent role
   */
  private getToolsForRole(role: string): string[] {
    const toolMap: Record<string, string[]> = {
      researcher: ["read_local_file", "list_dir"],
      bash_operator: ["execute_bash", "read_local_file", "list_dir", "write_to_file"],
      writer: ["write_to_file", "read_local_file", "list_dir"]
    };

    return toolMap[role] || [];
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): TaskNode | undefined {
    return this.taskGraph.get(taskId);
  }

  /**
   * Get all task statuses
   */
  getAllTaskStatuses(): Map<string, TaskNode> {
    return new Map(this.taskGraph);
  }

  /**
   * Clear task graph
   */
  clear(): void {
    this.taskGraph.clear();
    this.removeAllListeners();
  }
}

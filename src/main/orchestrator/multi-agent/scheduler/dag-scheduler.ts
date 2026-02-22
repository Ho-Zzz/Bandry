import { EventEmitter } from "events";
import type { DAGPlan, TaskNode, AgentResult } from "../agents/types";
import type { WorkerPool } from "../workers/worker-pool";

/**
 * DAG Scheduler
 * Manages task dependencies and execution order
 */
export class DAGScheduler extends EventEmitter {
  private taskGraph: Map<string, TaskNode> = new Map();

  constructor(private workerPool: WorkerPool) {
    super();
  }

  /**
   * Schedule a DAG plan for execution
   */
  async scheduleDAG(plan: DAGPlan, workspacePath: string): Promise<Map<string, AgentResult>> {
    // Build task graph
    this.buildTaskGraph(plan);

    // Start execution
    await this.executeDAG(workspacePath);

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
  private async executeDAG(workspacePath: string): Promise<void> {
    const executing = new Set<string>();
    const completed = new Set<string>();

    while (completed.size < this.taskGraph.size) {
      // Find ready tasks (no pending dependencies)
      const readyTasks = this.getReadyTasks(completed, executing);

      if (readyTasks.length === 0) {
        // Check if we're stuck (circular dependency or all tasks failed)
        if (executing.size === 0) {
          const failedTasks = Array.from(this.taskGraph.values())
            .filter((node) => node.status === "failed")
            .map((node) => node.task.subTaskId);

          if (failedTasks.length > 0) {
            throw new Error(`Tasks failed: ${failedTasks.join(", ")}`);
          }

          throw new Error("Circular dependency detected or no tasks can proceed");
        }

        // Wait for running tasks
        await this.waitForAnyTask(executing);
        continue;
      }

      // Start ready tasks
      for (const taskId of readyTasks) {
        executing.add(taskId);
        this.executeTask(taskId, workspacePath, executing, completed);
      }
    }
  }

  /**
   * Get tasks that are ready to execute
   */
  private getReadyTasks(completed: Set<string>, executing: Set<string>): string[] {
    const ready: string[] = [];

    for (const [taskId, node] of this.taskGraph.entries()) {
      if (node.status !== "pending") continue;
      if (executing.has(taskId)) continue;

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

  /**
   * Execute a single task
   */
  private async executeTask(
    taskId: string,
    workspacePath: string,
    executing: Set<string>,
    completed: Set<string>
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
        writePath: node.task.writePath
      });

      node.status = "completed";
      node.result = result;
      node.completedAt = Date.now();

      this.emit("task:completed", taskId, result);
    } catch (error) {
      node.status = "failed";
      node.result = {
        success: false,
        output: "",
        error: error instanceof Error ? error.message : String(error)
      };
      node.completedAt = Date.now();

      this.emit("task:failed", taskId, node.result.error);
    } finally {
      executing.delete(taskId);
      completed.add(taskId);
    }
  }

  /**
   * Wait for any task to complete
   */
  private async waitForAnyTask(_executing: Set<string>): Promise<void> {
    return new Promise((resolve) => {
      const handler = () => {
        this.removeListener("task:completed", handler);
        this.removeListener("task:failed", handler);
        resolve();
      };

      this.once("task:completed", handler);
      this.once("task:failed", handler);
    });
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

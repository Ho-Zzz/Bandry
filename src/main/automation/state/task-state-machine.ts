import { EventEmitter } from "events";
import * as fs from "fs/promises";
import * as path from "path";
import type {
  TaskState,
  TaskRecord,
  StateTransitionEvent,
  StateChangeHandler
} from "./types";

/**
 * Task state machine
 * Manages task lifecycle and state transitions
 */
export class TaskStateMachine extends EventEmitter {
  private tasks: Map<string, TaskRecord> = new Map();
  private traceDir: string;

  constructor(traceDir: string) {
    super();
    this.traceDir = traceDir;
  }

  /**
   * Create a new task
   */
  async createTask(taskId: string, metadata?: Record<string, unknown>): Promise<TaskRecord> {
    const task: TaskRecord = {
      taskId,
      state: "PENDING",
      createdAt: Date.now(),
      metadata
    };

    this.tasks.set(taskId, task);
    await this.persistTask(task);

    return task;
  }

  /**
   * Transition task to new state
   */
  async transition(
    taskId: string,
    toState: TaskState,
    reason?: string
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const fromState = task.state;

    // Validate transition
    this.validateTransition(fromState, toState);

    // Update task state
    task.state = toState;

    // Update timestamps
    const now = Date.now();
    if (toState === "RUNNING" && !task.startedAt) {
      task.startedAt = now;
    } else if (toState === "PAUSED_FOR_HITL") {
      task.pausedAt = now;
    } else if (toState === "COMPLETED" || toState === "FAILED") {
      task.completedAt = now;
    }

    // Persist state change
    await this.persistTask(task);

    // Emit event
    const event: StateTransitionEvent = {
      taskId,
      fromState,
      toState,
      timestamp: now,
      reason
    };

    this.emit("stateChange", event);
    this.emit(`state:${toState}`, event);
  }

  /**
   * Validate state transition
   */
  private validateTransition(from: TaskState, to: TaskState): void {
    const validTransitions: Record<TaskState, TaskState[]> = {
      PENDING: ["RUNNING", "FAILED"],
      RUNNING: ["PAUSED_FOR_HITL", "COMPLETED", "FAILED"],
      PAUSED_FOR_HITL: ["RUNNING", "FAILED"],
      COMPLETED: [],
      FAILED: []
    };

    const allowed = validTransitions[from];
    if (!allowed.includes(to)) {
      throw new Error(`Invalid transition: ${from} -> ${to}`);
    }
  }

  /**
   * Get task state
   */
  getTask(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): TaskRecord[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by state
   */
  getTasksByState(state: TaskState): TaskRecord[] {
    return Array.from(this.tasks.values()).filter((task) => task.state === state);
  }

  /**
   * Set task error
   */
  async setError(taskId: string, error: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.error = error;
    await this.persistTask(task);
  }

  /**
   * Update task metadata
   */
  async updateMetadata(
    taskId: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.metadata = { ...task.metadata, ...metadata };
    await this.persistTask(task);
  }

  /**
   * Persist task to trace file
   */
  private async persistTask(task: TaskRecord): Promise<void> {
    try {
      const tracePath = path.join(this.traceDir, `${task.taskId}.jsonl`);
      const traceDir = path.dirname(tracePath);

      // Ensure directory exists
      await fs.mkdir(traceDir, { recursive: true });

      // Append task state as JSONL
      const line = JSON.stringify({
        timestamp: Date.now(),
        task
      }) + "\n";

      await fs.appendFile(tracePath, line, "utf8");
    } catch (error) {
      console.error(`Failed to persist task ${task.taskId}:`, error);
    }
  }

  /**
   * Register state change handler
   */
  onStateChange(handler: StateChangeHandler): void {
    this.on("stateChange", handler);
  }

  /**
   * Remove state change handler
   */
  offStateChange(handler: StateChangeHandler): void {
    this.off("stateChange", handler);
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks.clear();
    this.removeAllListeners();
  }
}

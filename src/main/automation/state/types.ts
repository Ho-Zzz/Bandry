/**
 * Task state in lifecycle
 */
export type TaskState = "PENDING" | "RUNNING" | "PAUSED_FOR_HITL" | "COMPLETED" | "FAILED";

/**
 * Task record with state
 */
export type TaskRecord = {
  taskId: string;
  state: TaskState;
  createdAt: number;
  startedAt?: number;
  pausedAt?: number;
  completedAt?: number;
  error?: string;
  metadata?: Record<string, unknown>;
};

/**
 * State transition event
 */
export type StateTransitionEvent = {
  taskId: string;
  fromState: TaskState;
  toState: TaskState;
  timestamp: number;
  reason?: string;
};

/**
 * State change handler
 */
export type StateChangeHandler = (event: StateTransitionEvent) => void | Promise<void>;

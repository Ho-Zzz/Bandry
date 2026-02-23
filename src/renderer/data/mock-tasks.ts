/**
 * Mock Tasks Data
 *
 * Utility functions for DAG task management.
 * Uses localStorage for persistence during development.
 */

import type { DAGTask, SubTask, TaskStatus } from "../types/task";

const STORAGE_KEY = "bandry_mock_tasks";

/**
 * Get mock tasks from localStorage
 */
export const getMockTasks = (): DAGTask[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return [];
};

/**
 * Save mock tasks to localStorage
 */
export const saveMockTasks = (tasks: DAGTask[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
};

/**
 * Generate a new task ID
 */
export const generateTaskId = (): string => {
  return `task_${Date.now()}`;
};

/**
 * Create a new empty task
 */
export const createEmptyTask = (prompt: string): DAGTask => ({
  task_id: generateTaskId(),
  prompt,
  status: "PENDING",
  sub_tasks: [],
  workspace_path: `~/.bandry/workspaces/task_${Date.now()}`,
  input_files: [],
  output_files: [],
  created_at: Date.now(),
  trace_log: []
});

/**
 * Update task status
 */
export const updateTaskStatus = (
  tasks: DAGTask[],
  taskId: string,
  status: TaskStatus
): DAGTask[] => {
  return tasks.map((t) =>
    t.task_id === taskId ? { ...t, status } : t
  );
};

/**
 * Update sub-task within a task
 */
export const updateSubTask = (
  tasks: DAGTask[],
  taskId: string,
  subTaskId: string,
  updates: Partial<SubTask>
): DAGTask[] => {
  return tasks.map((t) =>
    t.task_id === taskId
      ? {
          ...t,
          sub_tasks: t.sub_tasks.map((st) =>
            st.sub_task_id === subTaskId ? { ...st, ...updates } : st
          )
        }
      : t
  );
};

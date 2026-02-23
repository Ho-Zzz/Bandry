/**
 * Task Store
 *
 * Zustand store for managing DAG tasks state.
 * Uses mock data with localStorage persistence during development.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DAGTask, SubTask, TaskStatus } from "../types/task";
import {
  getMockTasks,
  saveMockTasks,
  createEmptyTask,
} from "../data/mock-tasks";

interface TaskState {
  tasks: DAGTask[];
  activeTaskId: string | null;
  loading: boolean;

  fetchTasks: () => void;
  addTask: (prompt: string) => DAGTask;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  updateSubTask: (
    taskId: string,
    subTaskId: string,
    updates: Partial<SubTask>
  ) => void;
  setActiveTask: (id: string | null) => void;
  deleteTask: (id: string) => void;

  getTask: (id: string) => DAGTask | undefined;
  getActiveTask: () => DAGTask | undefined;
  getTasksByStatus: (status: TaskStatus) => DAGTask[];
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      activeTaskId: null,
      loading: false,

      fetchTasks: () => {
        set({ loading: true });
        const tasks = getMockTasks();
        set({ tasks, loading: false });
      },

      addTask: (prompt: string) => {
        const newTask = createEmptyTask(prompt);
        set((state) => {
          const tasks = [newTask, ...state.tasks];
          saveMockTasks(tasks);
          return { tasks, activeTaskId: newTask.task_id };
        });
        return newTask;
      },

      updateTaskStatus: (taskId: string, status: TaskStatus) => {
        set((state) => {
          const tasks = state.tasks.map((t) =>
            t.task_id === taskId
              ? { ...t, status, completed_at: status === "COMPLETED" ? Date.now() : undefined }
              : t
          );
          saveMockTasks(tasks);
          return { tasks };
        });
      },

      updateSubTask: (
        taskId: string,
        subTaskId: string,
        updates: Partial<SubTask>
      ) => {
        set((state) => {
          const tasks = state.tasks.map((t) =>
            t.task_id === taskId
              ? {
                  ...t,
                  sub_tasks: t.sub_tasks.map((st) =>
                    st.sub_task_id === subTaskId ? { ...st, ...updates } : st
                  ),
                }
              : t
          );
          saveMockTasks(tasks);
          return { tasks };
        });
      },

      setActiveTask: (id: string | null) => {
        set({ activeTaskId: id });
      },

      deleteTask: (id: string) => {
        set((state) => {
          const tasks = state.tasks.filter((t) => t.task_id !== id);
          saveMockTasks(tasks);
          return {
            tasks,
            activeTaskId: state.activeTaskId === id ? null : state.activeTaskId,
          };
        });
      },

      getTask: (id: string) => {
        return get().tasks.find((t) => t.task_id === id);
      },

      getActiveTask: () => {
        const { tasks, activeTaskId } = get();
        return activeTaskId ? tasks.find((t) => t.task_id === activeTaskId) : undefined;
      },

      getTasksByStatus: (status: TaskStatus) => {
        return get().tasks.filter((t) => t.status === status);
      },
    }),
    {
      name: "task-store",
      partialize: (state) => ({
        tasks: state.tasks,
        activeTaskId: state.activeTaskId,
      }),
    }
  )
);

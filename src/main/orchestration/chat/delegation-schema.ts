import { z } from "zod";
import type { PlannerDelegatedTask } from "./planner-types";

const delegatedTaskSchema = z.object({
  subTaskId: z.string().min(1),
  agentRole: z.enum(["researcher", "bash_operator", "writer"]),
  prompt: z.string().min(1),
  dependencies: z.array(z.string()),
  writePath: z.string().min(1).optional()
});

const delegationSchema = z.array(delegatedTaskSchema).min(1);

const validateDependencyGraph = (tasks: PlannerDelegatedTask[]): void => {
  const taskIds = new Set(tasks.map((task) => task.subTaskId));

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!taskIds.has(dep)) {
        throw new Error(`Invalid dependency: ${dep} not found for task ${task.subTaskId}`);
      }
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const graph = new Map(tasks.map((task) => [task.subTaskId, task.dependencies]));

  const dfs = (taskId: string): void => {
    if (visiting.has(taskId)) {
      throw new Error(`Circular dependency detected at task ${taskId}`);
    }
    if (visited.has(taskId)) {
      return;
    }

    visiting.add(taskId);
    const deps = graph.get(taskId) ?? [];
    for (const dep of deps) {
      dfs(dep);
    }
    visiting.delete(taskId);
    visited.add(taskId);
  };

  for (const task of tasks) {
    dfs(task.subTaskId);
  }
};

export const validateDelegationTasks = (rawTasks: unknown): PlannerDelegatedTask[] => {
  const tasks = delegationSchema.parse(rawTasks);

  const seen = new Set<string>();
  for (const task of tasks) {
    if (seen.has(task.subTaskId)) {
      throw new Error(`Duplicate subTaskId: ${task.subTaskId}`);
    }
    seen.add(task.subTaskId);
  }

  validateDependencyGraph(tasks);
  return tasks;
};

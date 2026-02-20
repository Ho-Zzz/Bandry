/**
 * Mock Tasks Data
 *
 * Sample DAG tasks for development and testing.
 * Uses localStorage for persistence during development.
 */

import type { DAGTask, SubTask, TaskStatus } from "../types/task";

const STORAGE_KEY = "bandry_mock_tasks";

/**
 * Default mock tasks for initial state
 */
const DEFAULT_TASKS: DAGTask[] = [
  {
    task_id: "task_001",
    prompt: "研究 2026 年 RAG 框架最新方案并生成报告",
    status: "RUNNING",
    workspace_path: "~/.bandry/workspaces/task_001",
    input_files: [],
    output_files: [],
    created_at: Date.now() - 300000,
    trace_log: [],
    sub_tasks: [
      {
        sub_task_id: "sub_01",
        agent_role: "WebResearcher",
        prompt: "搜索 2026 RAG 框架最新方案，重点关注 GraphRAG 和混合检索技术",
        dependencies: [],
        write_path: "staging/research.md",
        status: "COMPLETED",
        output: "已找到 5 篇相关文章，重点包括 GraphRAG、ColBERT late interaction 等...",
        started_at: Date.now() - 280000,
        completed_at: Date.now() - 200000
      },
      {
        sub_task_id: "sub_02",
        agent_role: "Writer",
        prompt: "根据 staging/research.md 生成结构化报告，保存到 output/report.md",
        dependencies: ["sub_01"],
        write_path: "output/report.md",
        status: "RUNNING",
        started_at: Date.now() - 180000
      }
    ]
  },
  {
    task_id: "task_002",
    prompt: "清理项目依赖并重新安装",
    status: "PAUSED_FOR_HITL",
    workspace_path: "~/.bandry/workspaces/task_002",
    input_files: [],
    output_files: [],
    created_at: Date.now() - 600000,
    trace_log: [],
    sub_tasks: [
      {
        sub_task_id: "sub_01",
        agent_role: "BashOperator",
        prompt: "执行 rm -rf node_modules 删除现有依赖",
        dependencies: [],
        write_path: "",
        status: "PAUSED_FOR_HITL"
      },
      {
        sub_task_id: "sub_02",
        agent_role: "BashOperator",
        prompt: "执行 pnpm install 重新安装依赖",
        dependencies: ["sub_01"],
        write_path: "",
        status: "PENDING"
      }
    ]
  },
  {
    task_id: "task_003",
    prompt: "分析项目代码结构并生成文档",
    status: "COMPLETED",
    workspace_path: "~/.bandry/workspaces/task_003",
    input_files: ["~/project/src"],
    output_files: ["output/docs.md"],
    created_at: Date.now() - 3600000,
    completed_at: Date.now() - 3000000,
    trace_log: [],
    sub_tasks: [
      {
        sub_task_id: "sub_01",
        agent_role: "Researcher",
        prompt: "分析 src 目录下的代码结构和模块划分",
        dependencies: [],
        write_path: "staging/analysis.md",
        status: "COMPLETED",
        completed_at: Date.now() - 3400000
      },
      {
        sub_task_id: "sub_02",
        agent_role: "Writer",
        prompt: "根据分析结果生成项目文档",
        dependencies: ["sub_01"],
        write_path: "output/docs.md",
        status: "COMPLETED",
        completed_at: Date.now() - 3100000
      }
    ]
  }
];

/**
 * Get mock tasks from localStorage or return defaults
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TASKS));
  return DEFAULT_TASKS;
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

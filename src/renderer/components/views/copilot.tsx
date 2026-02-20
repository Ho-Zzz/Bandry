/**
 * Copilot View Component
 *
 * Main interface for interacting with the Lead Agent.
 * Features task list, DAG visualization, and CopilotKit chat integration.
 */

import { useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardBody,
  Chip,
  Button,
  Textarea,
} from "@heroui/react";
import {
  Zap,
  CheckCircle,
  Clock,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  FolderOpen,
  Send,
} from "lucide-react";
import { clsx } from "clsx";
import { useTaskStore } from "../../store/use-task-store";
import type { DAGTask, SubTask, TaskStatus } from "../../types/task";

/**
 * Task Status Configuration
 */
const taskStatusConfig: Record<
  TaskStatus,
  { color: "success" | "warning" | "danger" | "default"; icon: typeof CheckCircle; label: string }
> = {
  PENDING: { color: "default", icon: Clock, label: "Pending" },
  RUNNING: { color: "warning", icon: Loader2, label: "Running" },
  PAUSED_FOR_HITL: { color: "danger", icon: AlertTriangle, label: "Waiting for Approval" },
  COMPLETED: { color: "success", icon: CheckCircle, label: "Completed" },
  FAILED: { color: "danger", icon: AlertTriangle, label: "Failed" },
};

/**
 * SubTask Node Component
 */
const SubTaskNode = ({
  subTask,
  isActive,
  onClick,
}: {
  subTask: SubTask;
  isActive: boolean;
  onClick?: () => void;
}) => {
  const config = taskStatusConfig[subTask.status];
  const Icon = config.icon;

  return (
    <Card
      isPressable={!!onClick}
      onPress={onClick}
      className={clsx(
        "w-64 shrink-0 transition-all",
        isActive && "ring-2 ring-blue-500 shadow-lg"
      )}
    >
      <CardHeader className="flex items-center gap-2 pb-0 pt-3 px-3">
        <Chip size="sm" color={config.color} variant="flat">
          <Icon
            size={14}
            className={subTask.status === "RUNNING" ? "animate-spin" : ""}
          />
        </Chip>
        <span className="font-medium text-sm text-gray-900">{subTask.agent_role}</span>
      </CardHeader>
      <CardBody className="pt-2 pb-3 px-3">
        <p className="text-xs text-gray-600 line-clamp-2 mb-2">{subTask.prompt}</p>
        {subTask.write_path && (
          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500 truncate block">
            {subTask.write_path}
          </code>
        )}
      </CardBody>
    </Card>
  );
};

/**
 * DAG Visualizer Component
 */
const DAGVisualizer = ({ task }: { task: DAGTask }) => {
  const levels = useMemo(() => {
    const result: SubTask[][] = [];
    const assigned = new Set<string>();

    while (assigned.size < task.sub_tasks.length) {
      const level: SubTask[] = [];
      for (const st of task.sub_tasks) {
        if (assigned.has(st.sub_task_id)) continue;
        const depsMet = st.dependencies.every((d) => assigned.has(d));
        if (depsMet) {
          level.push(st);
          assigned.add(st.sub_task_id);
        }
      }
      if (level.length > 0) result.push(level);
      else break;
    }

    return result;
  }, [task.sub_tasks]);

  if (task.sub_tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400">
        <Zap size={48} className="mb-4 opacity-50" />
        <p className="text-lg font-medium">No sub-tasks yet</p>
        <p className="text-sm">Start a conversation to create tasks</p>
      </div>
    );
  }

  return (
    <div className="flex gap-8 overflow-x-auto p-6 min-h-full">
      {levels.map((level, levelIndex) => (
        <div key={levelIndex} className="flex flex-col gap-3">
          {level.map((st) => (
            <SubTaskNode key={st.sub_task_id} subTask={st} isActive={false} />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Task List Sidebar Component
 */
const TaskListSidebar = ({
  tasks,
  activeTaskId,
  onSelectTask,
}: {
  tasks: DAGTask[];
  activeTaskId: string | null;
  onSelectTask: (id: string) => void;
}) => {
  return (
    <div className="w-72 border-r border-gray-200 bg-gray-50/50 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 bg-white">
        <h2 className="font-bold text-lg text-gray-900">Tasks</h2>
        <p className="text-xs text-gray-500 mt-0.5">{tasks.length} tasks total</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 text-sm">
            <Zap size={24} className="mb-2 opacity-50" />
            <p>No tasks yet</p>
          </div>
        ) : (
          tasks.map((task) => {
            const config = taskStatusConfig[task.status];
            const Icon = config.icon;
            const isActive = task.task_id === activeTaskId;
            const truncatedPrompt =
              task.prompt.length > 30 ? task.prompt.slice(0, 30) + "..." : task.prompt;

            return (
              <Card
                key={task.task_id}
                isPressable
                className={isActive ? "ring-2 ring-blue-500" : ""}
                onPress={() => onSelectTask(task.task_id)}
              >
                <CardBody className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <Chip size="sm" color={config.color} variant="flat">
                      <Icon
                        size={12}
                        className={task.status === "RUNNING" ? "animate-spin" : ""}
                      />
                      <span className="ml-1">{config.label}</span>
                    </Chip>
                  </div>
                  <p className="text-sm font-medium text-gray-900 line-clamp-2">
                    {truncatedPrompt}
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    <FolderOpen size={10} />
                    <code className="truncate">{task.workspace_path}</code>
                  </div>
                </CardBody>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

/**
 * Chat Panel Component (placeholder for CopilotKit)
 */
const ChatPanel = ({
  taskId,
  onSendMessage,
}: {
  taskId: string | null;
  onSendMessage: (message: string) => void;
}) => {
  const [inputValue, setInputValue] = React.useState("");

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  return (
    <div className="w-96 border-l border-gray-200 flex flex-col bg-white h-full">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Bandry Assistant</h3>
        <p className="text-xs text-gray-500">
          {taskId ? "Continue working on your task" : "Start a new task"}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {!taskId && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Zap size={28} className="text-blue-500" />
            </div>
            <p className="text-lg font-medium text-gray-600 mb-1">How can I help?</p>
            <p className="text-sm">
              Describe what you want to accomplish and I'll break it down into tasks.
            </p>
          </div>
        )}
      </div>
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-end gap-2">
          <Textarea
            placeholder="Describe your task..."
            value={inputValue}
            onValueChange={setInputValue}
            minRows={1}
            maxRows={4}
            className="flex-1"
            classNames={{ input: "text-sm" }}
          />
          <Button
            isIconOnly
            color="primary"
            onPress={handleSend}
            isDisabled={!inputValue.trim()}
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
};

import React from "react";

/**
 * Copilot View Component
 */
export const Copilot = () => {
  const { taskId } = useParams<{ taskId?: string }>();
  const navigate = useNavigate();
  const { tasks, fetchTasks, setActiveTask, addTask, getTask } = useTaskStore();

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (taskId) {
      setActiveTask(taskId);
    }
  }, [taskId, setActiveTask]);

  const activeTask = taskId ? getTask(taskId) : undefined;

  const handleSelectTask = (id: string) => {
    setActiveTask(id);
    navigate(`/copilot/${id}`);
  };

  const handleSendMessage = (message: string) => {
    if (!taskId) {
      const newTask = addTask(message);
      navigate(`/copilot/${newTask.task_id}`);
    }
  };

  return (
    <div className="flex h-full w-full">
      {/* Left: Task List */}
      <TaskListSidebar
        tasks={tasks}
        activeTaskId={taskId || null}
        onSelectTask={handleSelectTask}
      />

      {/* Center: DAG Visualizer */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {activeTask ? (
          <>
            <div className="p-4 border-b bg-white flex items-center gap-3">
              <Button
                variant="light"
                size="sm"
                isIconOnly
                onPress={() => navigate("/copilot")}
              >
                <ArrowLeft size={16} />
              </Button>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-lg text-gray-900 truncate">
                  {activeTask.prompt}
                </h2>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Chip
                    size="sm"
                    color={taskStatusConfig[activeTask.status].color}
                    variant="flat"
                  >
                    {taskStatusConfig[activeTask.status].label}
                  </Chip>
                  <code className="truncate">{activeTask.workspace_path}</code>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <DAGVisualizer task={activeTask} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Zap size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Select or create a task</p>
              <p className="text-sm mt-1">Use the chat to describe what you want to do</p>
            </div>
          </div>
        )}
      </div>

      {/* Right: Chat Panel */}
      <ChatPanel taskId={taskId || null} onSendMessage={handleSendMessage} />
    </div>
  );
};

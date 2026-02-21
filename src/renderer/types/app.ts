/**
 * App Types
 * 
 * Core type definitions for the AI Studio application.
 * Includes entities for employees (AI agents), workflows, tasks, assets, and messaging.
 */

/**
 * Employee Role Types
 * Defines the specialization areas for AI employees
 */
export enum EmployeeRole {
  Researcher = 'Researcher',
  Writer = 'Writer',
  Planner = 'Planner',
  Analyst = 'Analyst',
}

/**
 * Employee (AI Agent)
 * Represents an AI employee/agent with specific capabilities and configuration
 */
export interface Employee {
  id: string;
  name: string;
  role: EmployeeRole;
  avatar: string; // URL to avatar image
  description: string;
  model: string; // LLM model identifier
  tools: string[];
  status: 'online' | 'busy' | 'offline';
  systemPrompt: string;
}

/**
 * Task Status
 * Represents the current state of a workflow task
 */
export enum TaskStatus {
  Idle = 'idle',
  Running = 'running',
  WaitingForReview = 'waiting_review',
  Completed = 'completed',
  Failed = 'failed',
}

/**
 * Workflow Step
 * Individual step within a workflow, can be an action or review checkpoint
 */
export interface WorkflowStep {
  id: string;
  type: 'action' | 'review';
  employeeId?: string; // For action steps, which employee performs it
  name: string;
  config?: Record<string, unknown>;
}

/**
 * Workflow
 * Defines an automated multi-step process involving AI employees
 */
export interface Workflow {
  id: string;
  name: string;
  description: string;
  trigger: 'manual' | 'daily' | 'file_change';
  steps: WorkflowStep[];
  lastRun?: string;
  channelId?: string; // Output destination channel
}

/**
 * Task Log Entry
 * Individual log entry for task execution
 */
export interface TaskLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

/**
 * Task
 * Active instance of a workflow being executed
 */
export interface Task {
  id: string;
  workflowId: string;
  workflowName: string;
  status: TaskStatus;
  progress: number; // 0-100
  startTime: string;
  logs: TaskLog[];
  pendingReviewData?: {
    title: string;
    content: string;
    format: string;
  };
}

/**
 * Asset
 * File or folder accessible to AI agents
 */
export interface Asset {
  id: string;
  name: string;
  type: 'folder' | 'file';
  path: string;
  category: 'raw' | 'output' | 'reference';
  items?: number; // For folders, count of contained items
}

/**
 * Chat Message
 * Individual message in a conversation
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  senderId?: string; // For group channels, identifies the sender
}

/**
 * Channel
 * Group chat channel for team communication
 */
export interface Channel {
  id: string;
  type: 'channel';
  name: string;
  description: string;
  isPrivate: boolean;
  messages: ChatMessage[];
}

/**
 * Direct Message
 * One-on-one conversation between user and AI employee
 */
export interface DirectMessage {
  id: string;
  type: 'dm';
  employeeId: string;
  messages: ChatMessage[];
  lastActive: string;
}

/**
 * Navigation Item
 * Union type for all possible navigation destinations
 */
export type NavigationItem =
  | { type: 'view'; id: 'home' | 'workflows' | 'assets' | 'directory' | 'settings' }
  | { type: 'channel'; id: string }
  | { type: 'dm'; id: string }
  | { type: 'task'; id: string }
  | { type: 'conversation'; id: string };

/**
 * Sidebar Collapsed State
 */
export type SidebarState = 'expanded' | 'collapsed';

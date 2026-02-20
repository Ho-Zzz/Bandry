/**
 * Mock Data
 * 
 * Sample data for development and testing.
 * Includes AI employees, channels, direct messages, workflows, and assets.
 */

import type {
  Employee,
  Workflow,
  Task,
  Asset,
  Channel,
  DirectMessage,
} from '../types/app';
import { EmployeeRole, TaskStatus } from '../types/app';

/**
 * AI Employees
 * Sample AI agents with different specializations
 */
export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: 'emp_1',
    name: 'Research Agent',
    role: EmployeeRole.Researcher,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    description: 'Specializes in gathering information from web sources and summarizing findings.',
    model: 'gemini-2.5-flash-latest',
    tools: ['Google Search', 'Browser'],
    status: 'online',
    systemPrompt: 'You are a meticulous researcher...',
  },
  {
    id: 'emp_2',
    name: 'Creative Writer',
    role: EmployeeRole.Writer,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
    description: 'Expert in transforming dry facts into engaging social media content.',
    model: 'gemini-3-pro-preview',
    tools: ['Markdown Formatter'],
    status: 'busy',
    systemPrompt: 'You are a creative writer...',
  },
  {
    id: 'emp_3',
    name: 'Editor Chief',
    role: EmployeeRole.Planner,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jude',
    description: 'Organizes content calendars and reviews topic viability.',
    model: 'gemini-3-pro-preview',
    tools: ['Calendar'],
    status: 'offline',
    systemPrompt: 'You are a strategic planner...',
  },
];

/**
 * Channels
 * Group chat channels for team communication
 */
export const MOCK_CHANNELS: Channel[] = [
  {
    id: 'ch_general',
    type: 'channel',
    name: 'general',
    description: 'Company-wide announcements and work matters',
    isPrivate: false,
    messages: [
      {
        id: 'm1',
        role: 'system',
        content: 'Welcome to Digital Inc! This is where your AI workforce collaborates.',
        timestamp: 'Yesterday',
      },
    ],
  },
  {
    id: 'ch_content',
    type: 'channel',
    name: 'content-production',
    description: 'Daily content output stream',
    isPrivate: false,
    messages: [
      {
        id: 'm_c1',
        role: 'assistant',
        senderId: 'emp_3',
        content: 'The weekly editorial calendar has been updated. @Research Agent please start the deep dive on "Agentic Patterns".',
        timestamp: '10:00 AM',
      },
    ],
  },
  {
    id: 'ch_alerts',
    type: 'channel',
    name: 'workflow-alerts',
    description: 'Automated notifications from workflows',
    isPrivate: true,
    messages: [],
  },
];

/**
 * Direct Messages
 * One-on-one conversations with AI employees
 */
export const MOCK_DMS: DirectMessage[] = [
  {
    id: 'dm_emp_1',
    type: 'dm',
    employeeId: 'emp_1',
    lastActive: 'Now',
    messages: [
      {
        id: 'm_d1',
        role: 'assistant',
        content: 'I found 3 new sources regarding the Acme Corp merger. Shall I summarize them?',
        timestamp: '09:42 AM',
      },
    ],
  },
  {
    id: 'dm_emp_2',
    type: 'dm',
    employeeId: 'emp_2',
    lastActive: '10m ago',
    messages: [],
  },
];

/**
 * Workflows
 * Automated multi-step processes
 */
export const MOCK_WORKFLOWS: Workflow[] = [
  {
    id: 'wf_1',
    name: 'Daily Tech News Digest',
    description: 'Scrapes tech news, summarizes it, and prepares a draft.',
    trigger: 'daily',
    lastRun: 'Today, 9:00 AM',
    channelId: 'ch_content',
    steps: [
      { id: 's1', type: 'action', employeeId: 'emp_1', name: 'Gather Tech News' },
      { id: 's2', type: 'action', employeeId: 'emp_3', name: 'Select Top Stories' },
      { id: 's3', type: 'review', name: 'Human Review' },
      { id: 's4', type: 'action', employeeId: 'emp_2', name: 'Draft Blog Post' },
    ],
  },
  {
    id: 'wf_2',
    name: 'Podcast Notes Generator',
    description: 'Transcribes audio files and generates show notes.',
    trigger: 'file_change',
    lastRun: 'Yesterday, 4:20 PM',
    channelId: 'ch_content',
    steps: [
      { id: 's1', type: 'action', employeeId: 'emp_1', name: 'Transcribe Audio' },
      { id: 's2', type: 'action', employeeId: 'emp_2', name: 'Summarize' },
      { id: 's3', type: 'review', name: 'Final Review' },
    ],
  },
];

/**
 * Assets
 * Files and folders accessible to AI agents
 */
export const MOCK_ASSETS: Asset[] = [
  {
    id: 'a1',
    name: 'Raw Material',
    type: 'folder',
    path: '~/Documents/AI_Input',
    category: 'raw',
    items: 12,
  },
  {
    id: 'a2',
    name: 'Brand Voice Guide',
    type: 'file',
    path: '~/Documents/Brand/voice.md',
    category: 'reference',
    items: 1,
  },
  {
    id: 'a3',
    name: 'Published Outputs',
    type: 'folder',
    path: '~/Documents/AI_Output',
    category: 'output',
    items: 85,
  },
];

/**
 * Initial Task
 * Sample active task waiting for review
 */
export const INITIAL_TASK: Task = {
  id: 't_active_1',
  workflowId: 'wf_1',
  workflowName: 'Daily Tech News Digest',
  status: TaskStatus.WaitingForReview,
  progress: 60,
  startTime: '2023-10-27 09:00:00',
  logs: [
    {
      timestamp: '09:03:01',
      level: 'warn',
      message: 'Workflow paused. Waiting for Human Review.',
    },
  ],
  pendingReviewData: {
    title: 'Top Tech Stories Review',
    format: 'Markdown',
    content: `# Proposed Topics for Oct 27

1. **Gemini 3.0 Released**: Deep dive into the new reasoning capabilities.
   *Angle*: Focus on developer productivity.

2. **React Server Components**: New adoption metrics.
   *Angle*: Is it ready for enterprise?

3. **CSS Anchor Positioning**: Browser support update.
   *Angle*: Practical tutorial.

> Please approve or edit these topics before the writer starts.`,
  },
};

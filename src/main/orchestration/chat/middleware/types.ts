import type { LlmMessage } from "../../../llm/runtime/types";
import type { ModelsFactory } from "../../../llm/runtime";
import type { AppConfig } from "../../../config";
import type { SandboxService } from "../../../sandbox";
import type { ConversationStore } from "../../../persistence/sqlite";
import type { ChatMode, ChatUpdatePayload, ChatUpdateStage } from "../../../../shared/ipc";
import type { PlannerActionTool, ToolObservation } from "../planner-types";

/**
 * Tool definition for middleware context
 */
export type Tool = {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
};

/**
 * Todo item for sub-agents mode task tracking
 */
export type TodoItem = {
  id: string;
  subject: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
};

/**
 * Middleware context that flows through the pipeline
 * Contains all state needed for request processing
 *
 * Aligned with DeerFlow's AgentState pattern:
 * - beforeAgent/afterAgent: once per request
 * - beforeModel/afterModel: per model call
 * - wrapToolCall: tool execution interception
 */
export type MiddlewareContext = {
  /** Unique session identifier */
  sessionId: string;

  /** Unique task identifier */
  taskId: string;

  /** Conversation identifier for persistence middleware (title, memory, etc.) */
  conversationId?: string;

  /** Absolute path to task workspace directory */
  workspacePath: string;

  /** LLM messages (system, user, assistant) */
  messages: LlmMessage[];

  /** Available tools for this request */
  tools: Tool[];

  /** Arbitrary metadata for middleware communication */
  metadata: Record<string, unknown>;

  /** Current pipeline state */
  state:
    | "request"
    | "before_llm"
    | "after_llm"
    | "response"
    | "before_agent"
    | "before_model"
    | "after_model"
    | "after_agent";

  /** LLM response (populated after LLM execution) */
  llmResponse?: {
    content: string;
    toolCalls?: Array<{
      name: string;
      arguments: Record<string, unknown>;
    }>;
  };

  /** Final user-facing response text */
  finalResponse?: string;

  /** Chat mode for this request */
  chatMode?: ChatMode;

  /** Todo list for sub-agents mode (managed by TodoListMiddleware) */
  todos?: TodoItem[];

  /** Runtime collaborators available to middlewares */
  runtime?: {
    config: AppConfig;
    modelsFactory: ModelsFactory;
    sandboxService: SandboxService;
    conversationStore?: ConversationStore;
    onUpdate?: (stage: ChatUpdateStage, message: string, payload?: ChatUpdatePayload) => void;
    abortSignal?: AbortSignal;
  };
};

/**
 * Middleware hook function signature
 * Takes context, returns modified context
 */
export type MiddlewareHook = (ctx: MiddlewareContext) => Promise<MiddlewareContext>;

/**
 * Tool call wrapper input/output types
 */
export type ToolCallHandler = (
  ctx: MiddlewareContext,
  action: PlannerActionTool
) => Promise<ToolObservation>;

export type ToolCallWrapper = (
  ctx: MiddlewareContext,
  action: PlannerActionTool,
  next: ToolCallHandler
) => Promise<ToolObservation>;

/**
 * Middleware interface
 * Implements lifecycle hooks for request processing
 */
export interface Middleware {
  /** Middleware name for logging/debugging */
  name: string;

  /** Called once at the start of a request */
  beforeAgent?: MiddlewareHook;

  /** Called before each model call */
  beforeModel?: MiddlewareHook;

  /** Called after each model call */
  afterModel?: MiddlewareHook;

  /** Called once before returning final response */
  afterAgent?: MiddlewareHook;

  /** Wrap tool execution with interception capability */
  wrapToolCall?: ToolCallWrapper;

  /** Called when request is received, before any processing */
  onRequest?: MiddlewareHook;

  /** Called after prompt assembly, before LLM API call */
  beforeLLM?: MiddlewareHook;

  /** Called after LLM API returns, before response processing */
  afterLLM?: MiddlewareHook;

  /** Called before returning response to user */
  onResponse?: MiddlewareHook;
}

/**
 * LLM executor function signature
 * Middleware pipeline calls this to execute the actual LLM request
 */
export type LlmExecutor = (ctx: MiddlewareContext) => Promise<MiddlewareContext>;

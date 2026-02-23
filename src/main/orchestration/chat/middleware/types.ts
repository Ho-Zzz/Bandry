import type { LlmMessage } from "../../../llm/runtime/types";

/**
 * Tool definition for middleware context
 */
export type Tool = {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
};

/**
 * Middleware context that flows through the pipeline
 * Contains all state needed for request processing
 */
export type MiddlewareContext = {
  /** Unique session identifier */
  sessionId: string;

  /** Unique task identifier */
  taskId: string;

  /** Absolute path to task workspace directory */
  workspacePath: string;

  /** LLM messages (system, user, assistant) */
  messages: LlmMessage[];

  /** Available tools for this request */
  tools: Tool[];

  /** Arbitrary metadata for middleware communication */
  metadata: Record<string, unknown>;

  /** Current pipeline state */
  state: "request" | "before_llm" | "after_llm" | "response";

  /** LLM response (populated after LLM execution) */
  llmResponse?: {
    content: string;
    toolCalls?: Array<{
      name: string;
      arguments: Record<string, unknown>;
    }>;
  };
};

/**
 * Middleware hook function signature
 * Takes context, returns modified context
 */
export type MiddlewareHook = (ctx: MiddlewareContext) => Promise<MiddlewareContext>;

/**
 * Middleware interface
 * Implements lifecycle hooks for request processing
 */
export interface Middleware {
  /** Middleware name for logging/debugging */
  name: string;

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

import { randomUUID } from "crypto";
import type { MiddlewareContext } from "../middleware/types";
import type { LlmMessage } from "../../models/types";

/**
 * Create initial middleware context for a chat request
 */
export function createSessionContext(input: {
  sessionId?: string;
  taskId?: string;
  messages: LlmMessage[];
}): MiddlewareContext {
  return {
    sessionId: input.sessionId || randomUUID(),
    taskId: input.taskId || randomUUID(),
    workspacePath: "", // Will be set by WorkspaceMiddleware
    messages: input.messages,
    tools: [],
    metadata: {},
    state: "request"
  };
}

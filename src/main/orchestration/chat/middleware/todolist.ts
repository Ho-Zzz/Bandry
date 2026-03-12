import type { Middleware, MiddlewareContext, TodoItem } from "./types";

/**
 * TodoListMiddleware manages task lists for sub-agents mode.
 *
 * Lifecycle:
 * - beforeAgent: Load todos from storage (if any)
 * - afterAgent: Persist todos to storage
 *
 * The todos are stored in the middleware context and can be
 * manipulated by the write_todos tool.
 */
export class TodoListMiddleware implements Middleware {
  name = "todolist";

  // In-memory storage keyed by conversationId
  // TODO: Move to persistent storage (SQLite) in future
  private todosByConversation = new Map<string, TodoItem[]>();

  async beforeAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    // Only active in subagents mode
    if (ctx.chatMode !== "subagents") {
      return ctx;
    }

    const conversationId = ctx.conversationId;
    if (!conversationId) {
      return {
        ...ctx,
        todos: []
      };
    }

    // Load todos from storage
    const todos = this.todosByConversation.get(conversationId) ?? [];

    return {
      ...ctx,
      todos: [...todos]
    };
  }

  async afterAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    // Only active in subagents mode
    if (ctx.chatMode !== "subagents") {
      return ctx;
    }

    const conversationId = ctx.conversationId;
    if (!conversationId || !ctx.todos) {
      return ctx;
    }

    // Persist todos to storage
    this.todosByConversation.set(conversationId, [...ctx.todos]);

    return ctx;
  }

  /**
   * Update todos in context (called by write_todos tool)
   */
  static updateTodos(ctx: MiddlewareContext, todos: TodoItem[]): MiddlewareContext {
    return {
      ...ctx,
      todos: [...todos]
    };
  }

  /**
   * Get todos from context
   */
  static getTodos(ctx: MiddlewareContext): TodoItem[] {
    return ctx.todos ?? [];
  }
}

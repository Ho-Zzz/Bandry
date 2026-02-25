import type { TodoItem } from "../middleware/types";
import type { TodoInput, ToolObservation } from "../planner-types";

/**
 * write_todos tool for sub-agents mode.
 *
 * Updates the task list in the middleware context.
 * The TodoListMiddleware will persist the changes after the agent completes.
 */
export type WriteTodosInput = {
  todos: TodoInput[];
};

export type WriteTodosContext = {
  todos: TodoItem[];
};

/**
 * Execute write_todos tool
 */
export const executeWriteTodos = (
  input: WriteTodosInput,
  context: WriteTodosContext
): { observation: ToolObservation; updatedTodos: TodoItem[] } => {
  if (!input.todos || !Array.isArray(input.todos)) {
    return {
      observation: {
        tool: "write_todos",
        input: input as unknown as Record<string, unknown>,
        ok: false,
        output: "Invalid input: todos array is required"
      },
      updatedTodos: context.todos
    };
  }

  // Validate and normalize todos
  const validatedTodos: TodoItem[] = [];
  for (const todo of input.todos) {
    if (!todo.id || !todo.subject) {
      continue;
    }

    validatedTodos.push({
      id: todo.id,
      subject: todo.subject,
      description: todo.description ?? "",
      status: todo.status ?? "pending"
    });
  }

  // Merge with existing todos (update existing, add new)
  const existingMap = new Map(context.todos.map((t) => [t.id, t]));
  for (const todo of validatedTodos) {
    existingMap.set(todo.id, todo);
  }

  const updatedTodos = Array.from(existingMap.values());

  // Build summary
  const pending = updatedTodos.filter((t) => t.status === "pending").length;
  const inProgress = updatedTodos.filter((t) => t.status === "in_progress").length;
  const completed = updatedTodos.filter((t) => t.status === "completed").length;

  return {
    observation: {
      tool: "write_todos",
      input: { todoCount: validatedTodos.length },
      ok: true,
      output: `Updated ${validatedTodos.length} todos. Status: ${pending} pending, ${inProgress} in_progress, ${completed} completed.`
    },
    updatedTodos
  };
};

import type { PlannerAction, PlannerActionTool, PlannerDelegatedTask } from "./planner-types";

const extractJsonObject = (text: string): string | null => {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    const candidate = fencedMatch[1].trim();
    if (candidate.startsWith("{") && candidate.endsWith("}")) {
      return candidate;
    }
  }

  const start = text.indexOf("{");
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1).trim();
      }
    }
  }

  return null;
};

const parsePlannerInput = (inputRaw: unknown): PlannerActionTool["input"] => {
  if (typeof inputRaw !== "object" || inputRaw === null || Array.isArray(inputRaw)) {
    return {};
  }

  const obj = inputRaw as Record<string, unknown>;
  const parseDelegatedTasks = (rawTasks: unknown): PlannerDelegatedTask[] | undefined => {
    if (!Array.isArray(rawTasks)) {
      return undefined;
    }

    const tasks: PlannerDelegatedTask[] = [];
    for (const item of rawTasks) {
      if (typeof item !== "object" || item === null || Array.isArray(item)) {
        continue;
      }

      const node = item as Record<string, unknown>;
      const subTaskIdRaw = node.subTaskId ?? node.sub_task_id;
      const agentRoleRaw = node.agentRole ?? node.agent_role;
      const promptRaw = node.prompt;
      const dependenciesRaw = node.dependencies;
      const writePathRaw = node.writePath ?? node.write_path;

      if (typeof subTaskIdRaw !== "string" || typeof agentRoleRaw !== "string" || typeof promptRaw !== "string") {
        continue;
      }

      if (agentRoleRaw !== "researcher" && agentRoleRaw !== "bash_operator" && agentRoleRaw !== "writer") {
        continue;
      }

      tasks.push({
        subTaskId: subTaskIdRaw,
        agentRole: agentRoleRaw,
        prompt: promptRaw,
        dependencies: Array.isArray(dependenciesRaw)
          ? dependenciesRaw.filter((dep): dep is string => typeof dep === "string")
          : [],
        writePath: typeof writePathRaw === "string" ? writePathRaw : undefined
      });
    }

    return tasks;
  };

  return {
    path: typeof obj.path === "string" ? obj.path : undefined,
    content: typeof obj.content === "string" ? obj.content : undefined,
    overwrite: typeof obj.overwrite === "boolean" ? obj.overwrite : undefined,
    command: typeof obj.command === "string" ? obj.command : undefined,
    args: Array.isArray(obj.args) ? obj.args.filter((item): item is string => typeof item === "string") : undefined,
    cwd: typeof obj.cwd === "string" ? obj.cwd : undefined,
    timeoutMs: typeof obj.timeoutMs === "number" && Number.isFinite(obj.timeoutMs) ? obj.timeoutMs : undefined,
    query: typeof obj.query === "string" ? obj.query : undefined,
    url: typeof obj.url === "string" ? obj.url : undefined,
    question: typeof obj.question === "string" ? obj.question : undefined,
    tasks: parseDelegatedTasks(obj.tasks)
  };
};

export const parsePlannerAction = (rawText: string): PlannerAction | null => {
  const jsonText = extractJsonObject(rawText);
  if (!jsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const root = parsed as Record<string, unknown>;
    if (root.action === "answer") {
      const answer = typeof root.answer === "string" ? root.answer.trim() : "";
      if (!answer) {
        return null;
      }

      return { action: "answer", answer };
    }

    if (
      root.action === "tool" &&
      (root.tool === "list_dir" ||
        root.tool === "read_file" ||
        root.tool === "write_file" ||
        root.tool === "exec" ||
        root.tool === "web_search" ||
        root.tool === "web_fetch" ||
        root.tool === "github_search" ||
        root.tool === "delegate_sub_tasks" ||
        root.tool === "ask_clarification" ||
        root.tool === "memory_search" ||
        root.tool === "write_todos" ||
        root.tool === "task")
    ) {
      // Support both "input" and "action_input" field names
      const inputRaw = root.input ?? root.action_input;
      return {
        action: "tool",
        tool: root.tool,
        input: parsePlannerInput(inputRaw),
        reason: typeof root.reason === "string" ? root.reason : undefined
      };
    }
  } catch {
    return null;
  }

  return null;
};

import type { PlannerAction, PlannerActionTool } from "./planner-types";

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
  return {
    path: typeof obj.path === "string" ? obj.path : undefined,
    command: typeof obj.command === "string" ? obj.command : undefined,
    args: Array.isArray(obj.args) ? obj.args.filter((item): item is string => typeof item === "string") : undefined,
    cwd: typeof obj.cwd === "string" ? obj.cwd : undefined,
    timeoutMs: typeof obj.timeoutMs === "number" && Number.isFinite(obj.timeoutMs) ? obj.timeoutMs : undefined,
    query: typeof obj.query === "string" ? obj.query : undefined,
    url: typeof obj.url === "string" ? obj.url : undefined
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
        root.tool === "exec" ||
        root.tool === "web_search" ||
        root.tool === "web_fetch")
    ) {
      return {
        action: "tool",
        tool: root.tool,
        input: parsePlannerInput(root.input),
        reason: typeof root.reason === "string" ? root.reason : undefined
      };
    }
  } catch {
    return null;
  }

  return null;
};

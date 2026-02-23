import type { Middleware, MiddlewareContext } from "./types";

export const MAX_CONCURRENT_SUBAGENTS = 3;

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

export class SubagentLimitMiddleware implements Middleware {
  name = "subagent_limit";

  constructor(private readonly maxConcurrent: number = MAX_CONCURRENT_SUBAGENTS) {}

  async afterModel(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    const content = ctx.llmResponse?.content;
    if (!content) {
      return ctx;
    }

    const jsonText = extractJsonObject(content);
    if (!jsonText) {
      return ctx;
    }

    try {
      const parsed = JSON.parse(jsonText) as Record<string, unknown>;
      if (parsed.action !== "tool" || parsed.tool !== "delegate_sub_tasks") {
        return ctx;
      }

      const input = (parsed.input ?? {}) as Record<string, unknown>;
      const tasks = Array.isArray(input.tasks) ? input.tasks : [];
      if (tasks.length <= this.maxConcurrent) {
        return ctx;
      }

      const truncated = {
        ...parsed,
        input: {
          ...input,
          tasks: tasks.slice(0, this.maxConcurrent)
        }
      };

      return {
        ...ctx,
        llmResponse: {
          ...ctx.llmResponse!,
          content: JSON.stringify(truncated)
        },
        metadata: {
          ...ctx.metadata,
          subagentTruncatedCount: tasks.length - this.maxConcurrent,
          subagentMaxConcurrent: this.maxConcurrent
        }
      };
    } catch {
      return ctx;
    }
  }
}

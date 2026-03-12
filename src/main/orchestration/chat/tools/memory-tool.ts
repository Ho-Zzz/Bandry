import type { MemoryProvider } from "../../../memory/contracts/types";
import type { ToolObservation } from "../planner-types";

export type MemoryToolContext = {
  memoryProvider?: MemoryProvider;
  sessionId: string;
};

export const executeMemorySearch = async (
  input: { query?: string },
  context: MemoryToolContext
): Promise<ToolObservation> => {
  const query = input.query?.trim();
  if (!query) {
    return {
      tool: "memory_search",
      input: input,
      ok: false,
      output: "Missing required field: input.query"
    };
  }

  if (!context.memoryProvider) {
    return {
      tool: "memory_search",
      input: { query },
      ok: false,
      output: "Memory is not enabled. Enable OpenViking in settings to use memory_search."
    };
  }

  try {
    const chunks = await context.memoryProvider.injectContext(context.sessionId, query);
    if (chunks.length === 0) {
      return {
        tool: "memory_search",
        input: { query },
        ok: true,
        output: "No relevant memories found for this query."
      };
    }

    const lines = chunks.map((chunk, index) => {
      const header = `[${index + 1}] ${chunk.source} (${chunk.layer})`;
      const score = chunk.relevance !== undefined ? ` score=${chunk.relevance.toFixed(3)}` : "";
      return `${header}${score}\n${chunk.content}`;
    });

    return {
      tool: "memory_search",
      input: { query },
      ok: true,
      output: `Found ${chunks.length} memory chunks:\n\n${lines.join("\n\n")}`
    };
  } catch (error) {
    return {
      tool: "memory_search",
      input: { query },
      ok: false,
      output: `Memory search failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
};

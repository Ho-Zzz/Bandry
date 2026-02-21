import type { Middleware, MiddlewareContext } from "./types";
import type { MemoryProvider } from "../memory/types";

/**
 * Memory middleware
 * Injects context from memory before LLM and stores conversations after response
 */
export class MemoryMiddleware implements Middleware {
  name = "memory";

  constructor(private memory: MemoryProvider) {}

  /**
   * Inject memory context before LLM call
   */
  async beforeLLM(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    try {
      // Read memory layers (L0/L1 by default)
      const query = this.getLatestUserQuery(ctx);
      const chunks = await this.memory.injectContext(ctx.sessionId, query);

      if (chunks.length === 0) {
        return ctx;
      }

      // Format memory context as system message
      const memoryContent = this.formatMemoryContext(chunks);

      // Inject as first system message
      const updatedMessages = [
        {
          role: "system" as const,
          content: memoryContent
        },
        ...ctx.messages
      ];

      return {
        ...ctx,
        messages: updatedMessages,
        metadata: {
          ...ctx.metadata,
          memoryChunksInjected: chunks.length
        }
      };
    } catch (error) {
      console.error("[MemoryMiddleware] Failed to inject context:", error);
      return ctx;
    }
  }

  /**
   * Queue conversation for storage after response
   */
  async onResponse(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    try {
      // Extract conversation from context
      const conversation = {
        sessionId: ctx.sessionId,
        messages: ctx.messages.map((msg) => ({
          role: msg.role,
          content: msg.content,
          timestamp: Date.now()
        })),
        metadata: {
          taskId: ctx.taskId,
          workspacePath: ctx.workspacePath
        }
      };

      // Queue for debounced storage (non-blocking)
      await this.memory.storeConversation(conversation);

      return {
        ...ctx,
        metadata: {
          ...ctx.metadata,
          memoryStorageQueued: true
        }
      };
    } catch (error) {
      console.error("[MemoryMiddleware] Failed to queue storage:", error);
      return ctx;
    }
  }

  /**
   * Format memory chunks as system message
   */
  private formatMemoryContext(chunks: Array<{ source: string; content: string; layer: string }>): string {
    const lines = [
      "# Memory Context",
      "",
      "The following information has been retrieved from your memory:",
      ""
    ];

    for (const chunk of chunks) {
      lines.push(`## ${chunk.source} (${chunk.layer})`);
      lines.push("");
      lines.push(chunk.content);
      lines.push("");
    }

    lines.push("Use this context to inform your responses when relevant.");

    return lines.join("\n");
  }

  /**
   * Extract latest user query from context messages.
   */
  private getLatestUserQuery(ctx: MiddlewareContext): string {
    for (let i = ctx.messages.length - 1; i >= 0; i -= 1) {
      if (ctx.messages[i].role === "user") {
        return ctx.messages[i].content;
      }
    }

    return "";
  }
}

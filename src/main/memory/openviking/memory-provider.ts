import type { ContextChunk, Conversation, MemoryProvider } from "../contracts/types";
import type { OpenVikingFindResult, OpenVikingMatchedContext } from "./types";
import { OpenVikingHttpClient } from "./http-client";
import { runtimeLogger } from "../../logging/runtime-logger";

type OpenVikingMemoryProviderOptions = {
  targetUris: string[];
  topK: number;
  scoreThreshold?: number;
  commitDebounceMs: number;
  persistTimeoutMs?: number;
  persistClient?: OpenVikingHttpClient;
};

export class OpenVikingMemoryProvider implements MemoryProvider {
  private sessionMap = new Map<string, string>();
  private pendingStorage = new Map<string, NodeJS.Timeout>();
  private pendingConversations = new Map<string, Conversation>();
  private lastPersistedSignature = new Map<string, string>();

  private persistClient: OpenVikingHttpClient;

  constructor(
    private client: OpenVikingHttpClient,
    private options: OpenVikingMemoryProviderOptions
  ) {
    this.persistClient = options.persistClient ?? client;
  }

  async injectContext(sessionId: string, query?: string): Promise<ContextChunk[]> {
    const trimmedQuery = query?.trim() ?? "";
    if (!trimmedQuery) {
      return [];
    }

    try {
      const ovSessionId = await this.ensureSession(sessionId);
      const chunks: ContextChunk[] = [];
      const seen = new Set<string>();

      const searchResults = await Promise.all(
        this.options.targetUris.map(async (targetUri) => ({
          targetUri,
          result: await this.client.search({
            query: trimmedQuery,
            sessionId: ovSessionId,
            targetUri,
            limit: this.options.topK,
            scoreThreshold: this.options.scoreThreshold
          })
        }))
      );

      runtimeLogger.info({
        module: "memory",
        phase: "inject_context",
        traceId: sessionId,
        msg: "Memory search completed",
        extra: {
          query: trimmedQuery,
          targetUris: this.options.targetUris.join(","),
          searches: searchResults.length,
          hits: searchResults.reduce((count, item) => {
            const result = item.result;
            return count + (result.memories?.length ?? 0) + (result.resources?.length ?? 0) + (result.skills?.length ?? 0);
          }, 0)
        }
      });

      for (const { result } of searchResults) {
        const matched = this.collectMatchedContexts(result);
        for (const item of matched) {
          if (!item.uri || seen.has(item.uri)) {
            continue;
          }
          seen.add(item.uri);
          chunks.push({
            source: item.uri,
            content: this.toContextText(item),
            layer: "L1",
            relevance: item.score
          });
        }
      }

      return chunks.slice(0, this.options.topK);
    } catch (error) {
      runtimeLogger.error({
        module: "openviking",
        phase: "memory_inject",
        traceId: sessionId,
        msg: "Failed to inject context",
        extra: {
          error: error instanceof Error ? error.message : String(error),
        },
      });
      return [];
    }
  }

  async storeConversation(conversation: Conversation): Promise<void> {
    const existing = this.pendingStorage.get(conversation.sessionId);
    if (existing) {
      clearTimeout(existing);
    }

    this.pendingConversations.set(conversation.sessionId, conversation);
    const timeout = setTimeout(async () => {
      try {
        const pending = this.pendingConversations.get(conversation.sessionId);
        if (pending) {
          await this.persistConversation(pending);
        }
      } catch (error) {
        runtimeLogger.error({
          module: "openviking",
          phase: "memory_persist",
          traceId: conversation.sessionId,
          msg: "Failed to persist conversation",
          extra: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      } finally {
        this.pendingStorage.delete(conversation.sessionId);
        this.pendingConversations.delete(conversation.sessionId);
      }
    }, this.options.commitDebounceMs);

    this.pendingStorage.set(conversation.sessionId, timeout);
  }

  async flush(): Promise<void> {
    const pending = Array.from(this.pendingConversations.values());
    for (const timeout of this.pendingStorage.values()) {
      clearTimeout(timeout);
    }
    this.pendingStorage.clear();
    this.pendingConversations.clear();

    for (const conversation of pending) {
      try {
        await this.persistConversation(conversation);
      } catch (error) {
        runtimeLogger.error({
          module: "openviking",
          phase: "memory_flush",
          traceId: conversation.sessionId,
          msg: "Flush persist failed",
          extra: {
            error: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }
  }

  private async persistConversation(conversation: Conversation): Promise<void> {
    try {
      const ovSessionId = await this.ensureSession(conversation.sessionId);
      const messages = this.deduplicateAdjacentMessages(
        conversation.messages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .map((message) => ({
          role: message.role as "user" | "assistant",
          content: message.content.trim()
        }))
        .filter((message) => message.content.length > 0)
        .slice(-4)
      );

      if (messages.length === 0) {
        return;
      }

      const signature = messages.map((message) => `${message.role}:${message.content}`).join("\n");
      if (this.lastPersistedSignature.get(conversation.sessionId) === signature) {
        return;
      }

      for (const message of messages) {
        await this.persistClient.addSessionMessage(ovSessionId, message.role, message.content);
      }

      await this.withTimeout(
        this.persistClient.commitSession(ovSessionId),
        this.options.persistTimeoutMs ?? 15_000,
        `OpenViking commit timeout (${this.options.persistTimeoutMs ?? 15_000}ms)`
      );
      this.lastPersistedSignature.set(conversation.sessionId, signature);
    } catch (error) {
      // Silently fail persistence to avoid blocking or logging noise
      // Memory persistence is best-effort and should not affect chat functionality
      if (error instanceof Error && !error.message.includes("timeout")) {
        runtimeLogger.warn({
          module: "openviking",
          phase: "memory_persist",
          traceId: conversation.sessionId,
          msg: "Persist failed",
          extra: {
            error: error.message,
          },
        });
      }
    }
  }

  private async ensureSession(sessionId: string): Promise<string> {
    const existing = this.sessionMap.get(sessionId);
    if (existing) {
      return existing;
    }

    const created = await this.client.createSession();
    this.sessionMap.set(sessionId, created.sessionId);
    return created.sessionId;
  }

  private collectMatchedContexts(result: OpenVikingFindResult): OpenVikingMatchedContext[] {
    return [
      ...(result.memories ?? []),
      ...(result.resources ?? []),
      ...(result.skills ?? [])
    ];
  }

  private toContextText(item: OpenVikingMatchedContext): string {
    const lines = [];
    if (item.abstract) {
      lines.push(item.abstract);
    }
    if (item.match_reason) {
      lines.push(`Match reason: ${item.match_reason}`);
    }
    if (item.category) {
      lines.push(`Category: ${item.category}`);
    }

    if (lines.length === 0) {
      lines.push(item.uri);
    }

    return lines.join("\n");
  }

  private deduplicateAdjacentMessages(
    messages: Array<{ role: "user" | "assistant"; content: string }>
  ): Array<{ role: "user" | "assistant"; content: string }> {
    const deduped: Array<{ role: "user" | "assistant"; content: string }> = [];
    for (const message of messages) {
      const previous = deduped[deduped.length - 1];
      if (previous && previous.role === message.role && previous.content === message.content) {
        continue;
      }
      deduped.push(message);
    }
    return deduped;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        })
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}

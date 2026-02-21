import type { ContextChunk, Conversation, MemoryProvider } from "../v2/memory/types";
import type { OpenVikingFindResult, OpenVikingMatchedContext } from "./types";
import { OpenVikingHttpClient } from "./http-client";

type OpenVikingMemoryProviderOptions = {
  targetUris: string[];
  topK: number;
  scoreThreshold?: number;
  commitDebounceMs: number;
};

export class OpenVikingMemoryProvider implements MemoryProvider {
  private sessionMap = new Map<string, string>();
  private pendingStorage = new Map<string, NodeJS.Timeout>();
  private pendingConversations = new Map<string, Conversation>();
  private lastPersistedSignature = new Map<string, string>();

  constructor(
    private client: OpenVikingHttpClient,
    private options: OpenVikingMemoryProviderOptions
  ) {}

  async injectContext(sessionId: string, query?: string): Promise<ContextChunk[]> {
    const trimmedQuery = query?.trim() ?? "";
    if (!trimmedQuery) {
      return [];
    }

    try {
      const ovSessionId = await this.ensureSession(sessionId);
      const chunks: ContextChunk[] = [];
      const seen = new Set<string>();

      for (const targetUri of this.options.targetUris) {
        const result = await this.client.search({
          query: trimmedQuery,
          sessionId: ovSessionId,
          targetUri,
          limit: this.options.topK,
          scoreThreshold: this.options.scoreThreshold
        });

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
      console.error("[OpenVikingMemoryProvider] Failed to inject context:", error);
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
        console.error("[OpenVikingMemoryProvider] Failed to persist conversation:", error);
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
        console.error("[OpenVikingMemoryProvider] Flush persist failed:", error);
      }
    }
  }

  private async persistConversation(conversation: Conversation): Promise<void> {
    const ovSessionId = await this.ensureSession(conversation.sessionId);
    const messages = conversation.messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content.trim()
      }))
      .filter((message) => message.content.length > 0)
      .slice(-4);

    if (messages.length === 0) {
      return;
    }

    const signature = messages.map((message) => `${message.role}:${message.content}`).join("\n");
    if (this.lastPersistedSignature.get(conversation.sessionId) === signature) {
      return;
    }

    for (const message of messages) {
      await this.client.addSessionMessage(ovSessionId, message.role, message.content);
    }

    await this.client.commitSession(ovSessionId);
    this.lastPersistedSignature.set(conversation.sessionId, signature);
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
}

import type { ResourceStore } from "../../../resource-center";
import type { Middleware, MiddlewareContext } from "./types";

const STOP_WORDS = new Set([
  "the", "be", "to", "of", "and", "in", "that", "have", "it", "for",
  "not", "on", "with", "he", "as", "you", "do", "at", "this", "but",
  "his", "by", "from", "they", "we", "say", "her", "she", "or", "an",
  "will", "my", "one", "all", "would", "there", "their", "what", "so",
  "up", "out", "if", "about", "who", "get", "which", "go", "me", "when",
  "can", "like", "no", "just", "him", "how", "its", "may", "has", "into",
  "is", "are", "was", "were", "been", "am", "being", "did", "does",
  "help", "please", "want", "need", "let", "make"
]);

export class ResourceInjectionMiddleware implements Middleware {
  name = "resource_injection";

  constructor(private readonly resourceStore: ResourceStore) {}

  async beforeAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    try {
      const query = this.getLatestUserQuery(ctx);
      if (!query) return ctx;

      const keywords = this.extractKeywords(query);
      if (keywords.length === 0) return ctx;

      const resources = await this.resourceStore.search({
        keywords,
        minRelevance: 0.3,
        limit: 5
      });

      if (resources.length === 0) return ctx;

      const resourceContext = this.formatResourceContext(resources);
      const updatedMessages = [
        { role: "system" as const, content: resourceContext },
        ...ctx.messages
      ];

      return {
        ...ctx,
        messages: updatedMessages,
        metadata: {
          ...ctx.metadata,
          resourceInjectionCount: resources.length
        }
      };
    } catch (error) {
      console.error("[ResourceInjectionMiddleware] Failed to inject resources:", error);
      return ctx;
    }
  }

  private getLatestUserQuery(ctx: MiddlewareContext): string {
    for (let i = ctx.messages.length - 1; i >= 0; i -= 1) {
      if (ctx.messages[i].role === "user") {
        return ctx.messages[i].content;
      }
    }
    return "";
  }

  private extractKeywords(query: string): string[] {
    // TODO: integrate Intl.Segmenter or jieba for proper Chinese word segmentation
    const tokens = query
      .toLowerCase()
      .split(/[\s,;.!?，；。！？、]+/)
      .map((word) => word.trim())
      .filter((word) => word.length >= 2);

    // Filter common English stop words to reduce false-positive matches
    const filtered = tokens.filter((word) => !STOP_WORDS.has(word));

    return filtered.slice(0, 10);
  }

  private formatResourceContext(resources: Array<{ originalName: string; summary: string; category: string; tags: string[] }>): string {
    const lines = [
      "# Available Resources from Previous Tasks",
      "",
      "The following resources from your resource center may be relevant:",
      ""
    ];

    for (const resource of resources) {
      lines.push(`- **${resource.originalName}** [${resource.category}]: ${resource.summary}`);
      if (resource.tags.length > 0) {
        lines.push(`  Tags: ${resource.tags.join(", ")}`);
      }
    }

    lines.push("");
    lines.push("Reference these resources when relevant to the current task.");

    return lines.join("\n");
  }
}

import * as fs from "fs/promises";
import * as path from "path";
import type { ModelsFactory } from "../../llm/runtime";
import type { AppConfig } from "../../config";
import { resolveRuntimeTarget } from "../../llm/runtime/runtime-target";
import type {
  Conversation,
  ContextChunk,
  Fact,
  MemoryLayer,
  MemoryProvider,
  MemoryStorageOptions
} from "../../memory/contracts/types";
import { FactExtractor } from "../extraction/fact-extractor";
import { buildSummaryPrompt } from "../extraction/prompts";

/**
 * OpenViking memory adapter
 * Manages L0/L1/L2 memory layers with Markdown storage
 */
export class LayeredMemoryProvider implements MemoryProvider {
  private resourcesPath: string;
  private pendingStorage: Map<string, NodeJS.Timeout> = new Map();
  private options: Required<MemoryStorageOptions>;
  private factExtractor: FactExtractor;

  constructor(
    resourcesPath: string,
    private modelsFactory: ModelsFactory,
    private config: AppConfig,
    options: MemoryStorageOptions = {}
  ) {
    this.resourcesPath = resourcesPath;
    this.options = {
      debounceMs: options.debounceMs ?? 30000, // 30 seconds
      maxContextTokens: options.maxContextTokens ?? 4000,
      preferredLayers: options.preferredLayers ?? ["L0", "L1"]
    };
    this.factExtractor = new FactExtractor(modelsFactory, config);
  }

  /**
   * Inject context from memory into session
   */
  async injectContext(_sessionId: string, _query?: string): Promise<ContextChunk[]> {
    const chunks: ContextChunk[] = [];

    try {
      // Ensure resources directory exists
      await fs.mkdir(this.resourcesPath, { recursive: true });

      // Read L0 summaries first (most concise)
      if (this.options.preferredLayers.includes("L0")) {
        const l0Chunks = await this.readLayer("L0");
        chunks.push(...l0Chunks);
      }

      // Read L1 outlines if needed
      if (this.options.preferredLayers.includes("L1")) {
        const l1Chunks = await this.readLayer("L1");
        chunks.push(...l1Chunks);
      }

      // Only read L2 if explicitly requested (full content)
      if (this.options.preferredLayers.includes("L2")) {
        const l2Chunks = await this.readLayer("L2");
        chunks.push(...l2Chunks);
      }

      return chunks;
    } catch (error) {
      console.error("[LayeredMemoryProvider] Failed to inject context:", error);
      return [];
    }
  }

  /**
   * Read memory layer
   */
  private async readLayer(layer: MemoryLayer): Promise<ContextChunk[]> {
    const layerPath = path.join(this.resourcesPath, layer);
    const chunks: ContextChunk[] = [];

    try {
      const files = await fs.readdir(layerPath);

      for (const file of files) {
        if (!file.endsWith(".md")) continue;

        const filePath = path.join(layerPath, file);
        const content = await fs.readFile(filePath, "utf8");

        chunks.push({
          source: file,
          content,
          layer,
          relevance: 1.0
        });
      }
    } catch (error) {
      // Layer directory doesn't exist yet, that's ok
      if ((error as any).code !== "ENOENT") {
        console.error(`[LayeredMemoryProvider] Failed to read layer ${layer}:`, error);
      }
    }

    return chunks;
  }

  /**
   * Store conversation with debouncing
   */
  async storeConversation(conversation: Conversation): Promise<void> {
    const { sessionId } = conversation;

    // Cancel existing pending storage
    const existing = this.pendingStorage.get(sessionId);
    if (existing) {
      clearTimeout(existing);
    }

    // Schedule debounced storage
    const timeout = setTimeout(async () => {
      try {
        await this.persistConversation(conversation);
        this.pendingStorage.delete(sessionId);
      } catch (error) {
        console.error("[LayeredMemoryProvider] Failed to persist conversation:", error);
      }
    }, this.options.debounceMs);

    this.pendingStorage.set(sessionId, timeout);
  }

  /**
   * Persist conversation to memory layers
   */
  private async persistConversation(conversation: Conversation): Promise<void> {
    // Extract facts from conversation
    const facts = await this.extractFacts(conversation);

    if (facts.length === 0) {
      return;
    }

    // Generate L2 (full content)
    const l2Content = this.formatFacts(facts, "L2");
    await this.writeLayer("L2", conversation.sessionId, l2Content);

    // Generate L1 (outline)
    const l1Content = await this.summarize(l2Content, "outline");
    await this.writeLayer("L1", conversation.sessionId, l1Content);

    // Generate L0 (summary)
    const l0Content = await this.summarize(l1Content, "summary");
    await this.writeLayer("L0", conversation.sessionId, l0Content);
  }

  /**
   * Extract facts from conversation
   */
  async extractFacts(conversation: Conversation): Promise<Fact[]> {
    return this.factExtractor.extractFacts(conversation, {
      temperature: 0.2,
      maxFacts: 20,
      minConfidence: 0.5
    });
  }

  /**
   * Format facts as markdown
   */
  private formatFacts(facts: Fact[], layer: MemoryLayer): string {
    const lines = [`# Memory Layer ${layer}`, "", `Generated: ${new Date().toISOString()}`, ""];

    for (const fact of facts) {
      lines.push(`## ${fact.id}`);
      lines.push("");
      lines.push(fact.content);
      lines.push("");
      if (fact.tags && fact.tags.length > 0) {
        lines.push(`Tags: ${fact.tags.join(", ")}`);
        lines.push("");
      }
    }

    return lines.join("\n");
  }

  /**
   * Summarize content for higher layers
   */
  private async summarize(content: string, type: "outline" | "summary"): Promise<string> {
    const prompt = buildSummaryPrompt(type);

    try {
      const target = resolveRuntimeTarget(this.config, "memory.fact_extractor");
      const result = await this.modelsFactory.generateText({
        runtimeConfig: target.runtimeConfig,
        model: target.model,
        messages: [
          {
            role: "system",
            content: prompt
          },
          {
            role: "user",
            content
          }
        ],
        temperature: target.temperature ?? 0.3,
        maxTokens: target.maxTokens
      });

      return result.text;
    } catch (error) {
      console.error("[LayeredMemoryProvider] Failed to summarize:", error);
      return content; // Fallback to original
    }
  }

  /**
   * Write content to memory layer
   */
  private async writeLayer(layer: MemoryLayer, sessionId: string, content: string): Promise<void> {
    const layerPath = path.join(this.resourcesPath, layer);
    await fs.mkdir(layerPath, { recursive: true });

    const filePath = path.join(layerPath, `${sessionId}.md`);
    await fs.writeFile(filePath, content, "utf8");
  }

  /**
   * Flush pending storage (for cleanup)
   */
  async flush(): Promise<void> {
    const pending = Array.from(this.pendingStorage.values());
    for (const timeout of pending) {
      clearTimeout(timeout);
    }
    this.pendingStorage.clear();
  }
}

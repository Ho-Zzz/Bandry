import type { ModelsFactory } from "../../models";
import type { AppConfig } from "../../config";
import type { Fact, Conversation } from "./types";

/**
 * Fact extraction options
 */
export type FactExtractionOptions = {
  temperature?: number;
  maxFacts?: number;
  minConfidence?: number;
};

/**
 * Fact Extractor
 * Extracts structured facts from conversations using LLM
 */
export class FactExtractor {
  constructor(
    private modelsFactory: ModelsFactory,
    private config: AppConfig
  ) {}

  /**
   * Extract facts from a conversation
   */
  async extractFacts(
    conversation: Conversation,
    options: FactExtractionOptions = {}
  ): Promise<Fact[]> {
    const {
      temperature = 0.2,
      maxFacts = 20,
      minConfidence = 0.5
    } = options;

    // Build conversation text
    const conversationText = this.formatConversation(conversation);

    if (conversationText.trim().length === 0) {
      return [];
    }

    try {
      const result = await this.modelsFactory.generateText({
        provider: this.config.llm.defaultProvider,
        model: this.config.llm.defaultModel,
        messages: [
          {
            role: "system",
            content: this.getSystemPrompt(maxFacts)
          },
          {
            role: "user",
            content: conversationText
          }
        ],
        temperature
      });

      // Parse JSON response
      const facts = this.parseFactsResponse(result.text, conversation.sessionId);

      // Filter by confidence
      return facts.filter((fact) => (fact.confidence ?? 1.0) >= minConfidence);
    } catch (error) {
      console.error("[FactExtractor] Failed to extract facts:", error);
      return [];
    }
  }

  /**
   * Extract facts from plain text
   */
  async extractFromText(
    text: string,
    source: string,
    options: FactExtractionOptions = {}
  ): Promise<Fact[]> {
    const conversation: Conversation = {
      sessionId: source,
      messages: [
        {
          role: "user",
          content: text,
          timestamp: Date.now()
        }
      ]
    };

    return this.extractFacts(conversation, options);
  }

  /**
   * Format conversation for fact extraction
   */
  private formatConversation(conversation: Conversation): string {
    const lines: string[] = [];

    for (const message of conversation.messages) {
      // Skip system messages
      if (message.role === "system") {
        continue;
      }

      const role = message.role === "user" ? "User" : "Assistant";
      lines.push(`${role}: ${message.content}`);
    }

    return lines.join("\n\n");
  }

  /**
   * Get system prompt for fact extraction
   */
  private getSystemPrompt(maxFacts: number): string {
    return `You are a fact extraction system. Extract key facts from the conversation.

Rules:
1. Extract only important, actionable facts
2. Ignore pleasantries, greetings, and meta-discussion
3. Focus on: preferences, decisions, technical details, requirements, constraints
4. Each fact should be self-contained and clear
5. Assign relevant tags to each fact
6. Assign confidence score (0.0-1.0) based on clarity and importance
7. Extract up to ${maxFacts} facts

Return a JSON array of facts in this format:
[
  {
    "content": "User prefers TypeScript over JavaScript",
    "tags": ["preference", "language"],
    "confidence": 0.9
  },
  {
    "content": "Project uses Vite for bundling",
    "tags": ["tooling", "build"],
    "confidence": 1.0
  }
]

Only return the JSON array, no other text.`;
  }

  /**
   * Parse facts from LLM response
   */
  private parseFactsResponse(response: string, sessionId: string): Fact[] {
    try {
      // Extract JSON array from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn("[FactExtractor] No JSON array found in response");
        return [];
      }

      const factsData = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(factsData)) {
        console.warn("[FactExtractor] Response is not an array");
        return [];
      }

      // Convert to Fact objects
      const facts: Fact[] = [];
      const timestamp = Date.now();

      for (let i = 0; i < factsData.length; i++) {
        const factData = factsData[i];

        // Validate fact structure
        if (!factData.content || typeof factData.content !== "string") {
          console.warn(`[FactExtractor] Invalid fact at index ${i}: missing content`);
          continue;
        }

        facts.push({
          id: `${sessionId}_fact_${i}`,
          content: factData.content.trim(),
          source: sessionId,
          timestamp,
          tags: Array.isArray(factData.tags) ? factData.tags : [],
          confidence: typeof factData.confidence === "number" ? factData.confidence : 0.8
        });
      }

      return facts;
    } catch (error) {
      console.error("[FactExtractor] Failed to parse facts response:", error);
      return [];
    }
  }

  /**
   * Merge duplicate or similar facts
   */
  mergeFacts(facts: Fact[]): Fact[] {
    if (facts.length === 0) {
      return [];
    }

    const merged: Fact[] = [];
    const seen = new Set<string>();

    for (const fact of facts) {
      // Normalize content for comparison
      const normalized = fact.content.toLowerCase().trim();

      // Skip if we've seen this exact content
      if (seen.has(normalized)) {
        continue;
      }

      seen.add(normalized);
      merged.push(fact);
    }

    return merged;
  }

  /**
   * Filter facts by tags
   */
  filterByTags(facts: Fact[], tags: string[]): Fact[] {
    if (tags.length === 0) {
      return facts;
    }

    return facts.filter((fact) => {
      if (!fact.tags || fact.tags.length === 0) {
        return false;
      }

      // Check if fact has any of the specified tags
      return fact.tags.some((tag) => tags.includes(tag));
    });
  }

  /**
   * Sort facts by confidence
   */
  sortByConfidence(facts: Fact[]): Fact[] {
    return [...facts].sort((a, b) => {
      const confA = a.confidence ?? 0.8;
      const confB = b.confidence ?? 0.8;
      return confB - confA; // Descending order
    });
  }

  /**
   * Get top N facts by confidence
   */
  getTopFacts(facts: Fact[], n: number): Fact[] {
    const sorted = this.sortByConfidence(facts);
    return sorted.slice(0, n);
  }
}

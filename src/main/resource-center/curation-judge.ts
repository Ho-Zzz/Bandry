import type { AppConfig } from "../config";
import type { ModelsFactory } from "../llm/runtime";
import { resolveRuntimeTarget } from "../llm/runtime/runtime-target";
import type { CurationJudgment, CurationJudgmentResult, FilePreview, ResourceCategory } from "./types";

const VALID_CATEGORIES = new Set<ResourceCategory>(["document", "data", "code", "config", "other"]);

const SYSTEM_PROMPT = `You are a resource curation assistant. Evaluate task output files and decide which ones are worth preserving in a global resource center for future reuse.

For each file, determine:
- shouldTransfer: true if the file has lasting value (reusable code, reference data, documentation, config templates)
- category: one of "document", "data", "code", "config", "other"
- summary: a concise one-sentence description of the file's content and purpose
- relevance: 0.0-1.0 score indicating how useful this file would be for future tasks
- tags: 2-5 descriptive keywords
- reason: brief explanation of your decision

Skip temporary files, logs, intermediate outputs, and files with no reuse value.

Respond with a JSON array of judgments. Example:
[
  {
    "fileName": "report.md",
    "shouldTransfer": true,
    "category": "document",
    "summary": "Analysis report on API performance metrics",
    "relevance": 0.8,
    "tags": ["report", "api", "performance"],
    "reason": "Comprehensive reference document with reusable analysis methodology"
  }
]

Respond ONLY with the JSON array, no other text.`;

export class CurationJudge {
  constructor(
    private readonly appConfig: AppConfig,
    private readonly modelsFactory: ModelsFactory
  ) {}

  async evaluate(filePreviews: FilePreview[], taskContext: string, abortSignal?: AbortSignal): Promise<CurationJudgmentResult> {
    if (filePreviews.length === 0) {
      return { judgments: [], evaluatedCount: 0, transferCount: 0 };
    }

    const fileDescriptions = filePreviews
      .map(
        (fp) =>
          `--- ${fp.fileName} (${fp.sizeBytes} bytes) ---\n${fp.preview}`
      )
      .join("\n\n");

    const userPrompt = `Task context: ${taskContext}\n\nFiles to evaluate:\n\n${fileDescriptions}`;

    try {
      const target = resolveRuntimeTarget(this.appConfig, "lead.synthesizer");
      const result = await this.modelsFactory.generateText({
        runtimeConfig: target.runtimeConfig,
        model: target.model,
        temperature: 0,
        maxTokens: 2000,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt }
        ],
        abortSignal
      });

      const judgments = this.parseJudgments(result.text);
      return {
        judgments,
        evaluatedCount: filePreviews.length,
        transferCount: judgments.filter((j) => j.shouldTransfer).length
      };
    } catch (error) {
      console.error("[CurationJudge] LLM evaluation failed:", error);
      return { judgments: [], evaluatedCount: filePreviews.length, transferCount: 0 };
    }
  }

  private parseJudgments(text: string): CurationJudgment[] {
    try {
      // Extract JSON array from response (handle possible markdown fencing)
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]) as unknown[];
      if (!Array.isArray(parsed)) return [];

      return parsed.filter((item): item is CurationJudgment => {
        const obj = item as Record<string, unknown>;
        return (
          typeof obj.fileName === "string" &&
          typeof obj.shouldTransfer === "boolean" &&
          typeof obj.category === "string" &&
          VALID_CATEGORIES.has(obj.category as ResourceCategory) &&
          typeof obj.summary === "string" &&
          typeof obj.relevance === "number" &&
          Array.isArray(obj.tags)
        );
      });
    } catch {
      return [];
    }
  }
}

import fs, { open } from "node:fs/promises";
import path from "node:path";
import { CurationJudge } from "../../../resource-center/curation-judge";
import type { ResourceStore } from "../../../resource-center";
import type { FilePreview } from "../../../resource-center/types";
import type { Middleware, MiddlewareContext } from "./types";

const MAX_PREVIEW_CHARS = 2000;

const TEXT_EXTENSIONS = new Set([
  ".txt", ".md", ".json", ".csv", ".xml", ".yaml", ".yml",
  ".html", ".css", ".js", ".ts", ".jsx", ".tsx",
  ".py", ".rb", ".go", ".rs", ".java", ".c", ".cpp", ".h",
  ".sh", ".bash", ".zsh", ".toml", ".ini", ".cfg", ".conf",
  ".sql", ".graphql", ".proto", ".svg", ".log"
]);

export class ResourceCurationMiddleware implements Middleware {
  name = "resource_curation";

  constructor(private readonly resourceStore: ResourceStore) {}

  async afterAgent(ctx: MiddlewareContext): Promise<MiddlewareContext> {
    try {
      if (!ctx.workspacePath || !ctx.runtime) {
        return ctx;
      }

      const outputDir = path.join(ctx.workspacePath, "output");
      const filePreviews = await this.scanOutputFiles(outputDir);

      if (filePreviews.length === 0) {
        return {
          ...ctx,
          metadata: {
            ...ctx.metadata,
            resourceCurationEvaluated: 0,
            resourceCurationTransferred: 0
          }
        };
      }

      const taskContext = this.buildTaskContext(ctx);
      const judge = new CurationJudge(ctx.runtime.config, ctx.runtime.modelsFactory);
      const result = await judge.evaluate(filePreviews, taskContext, ctx.runtime.abortSignal);

      let transferred = 0;
      for (const judgment of result.judgments) {
        if (!judgment.shouldTransfer) continue;

        const sourcePath = path.resolve(outputDir, judgment.fileName);
        // Guard against path traversal from LLM-generated filenames
        if (!sourcePath.startsWith(path.resolve(outputDir) + path.sep)) continue;
        try {
          const stats = await fs.stat(sourcePath);
          await this.resourceStore.add(
            {
              originalName: judgment.fileName,
              category: judgment.category,
              summary: judgment.summary,
              relevance: judgment.relevance,
              sourceTaskId: ctx.taskId,
              tags: judgment.tags,
              sizeBytes: stats.size
            },
            sourcePath
          );
          transferred++;
        } catch (error) {
          console.error(`[ResourceCurationMiddleware] Failed to transfer ${judgment.fileName}:`, error);
        }
      }

      return {
        ...ctx,
        metadata: {
          ...ctx.metadata,
          resourceCurationEvaluated: result.evaluatedCount,
          resourceCurationTransferred: transferred
        }
      };
    } catch (error) {
      console.error("[ResourceCurationMiddleware] Curation failed:", error);
      return ctx;
    }
  }

  private async scanOutputFiles(outputDir: string): Promise<FilePreview[]> {
    try {
      const entries = await fs.readdir(outputDir, { withFileTypes: true });
      const previews: FilePreview[] = [];

      for (const entry of entries) {
        if (!entry.isFile()) continue;

        const filePath = path.join(outputDir, entry.name);
        const stats = await fs.stat(filePath);
        const ext = path.extname(entry.name).toLowerCase();
        const isText = TEXT_EXTENSIONS.has(ext);

        let preview: string;
        if (isText) {
          preview = await this.readPreview(filePath, MAX_PREVIEW_CHARS);
        } else {
          preview = "[binary file]";
        }

        previews.push({
          fileName: entry.name,
          sizeBytes: stats.size,
          preview
        });
      }

      return previews;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }
  }

  private async readPreview(filePath: string, maxChars: number): Promise<string> {
    // Read only the needed bytes instead of loading the entire file into memory
    const fd = await open(filePath, "r");
    try {
      // Allocate extra bytes to account for multi-byte UTF-8 characters
      const buf = Buffer.alloc(maxChars * 4);
      const { bytesRead } = await fd.read(buf, 0, buf.length, 0);
      return buf.toString("utf-8", 0, bytesRead).slice(0, maxChars);
    } finally {
      await fd.close();
    }
  }

  private buildTaskContext(ctx: MiddlewareContext): string {
    const userMessages = ctx.messages
      .filter((msg) => msg.role === "user")
      .map((msg) => msg.content);
    const lastUserMessage = userMessages[userMessages.length - 1] ?? "";
    const response = ctx.finalResponse ?? "";
    return `User request: ${lastUserMessage}\nAssistant response summary: ${response.slice(0, 500)}`;
  }
}

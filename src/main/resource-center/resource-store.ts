import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { ResourceCenterError } from "./errors";
import type { ResourceEntry, ResourceEntryInput, ResourceQueryFilter } from "./types";

export class ResourceStore {
  private readonly manifestPath: string;
  private readonly artifactsDir: string;

  constructor(resourcesDir: string) {
    this.manifestPath = path.join(resourcesDir, "manifest.jsonl");
    this.artifactsDir = path.join(resourcesDir, "artifacts");
  }

  async add(input: ResourceEntryInput, sourceFilePath: string): Promise<ResourceEntry> {
    await this.ensureDirs();

    const id = crypto.randomUUID();
    const ext = path.extname(input.originalName);
    const storedName = `${input.category}-${id}${ext}`;
    const destPath = path.join(this.artifactsDir, storedName);

    try {
      await fs.copyFile(sourceFilePath, destPath);
    } catch (error) {
      throw new ResourceCenterError("ARTIFACT_COPY_FAILED", `Failed to copy artifact: ${sourceFilePath}`, {
        sourceFilePath,
        destPath,
        cause: error instanceof Error ? error.message : String(error)
      });
    }

    const entry: ResourceEntry = {
      id,
      originalName: input.originalName,
      storedName,
      category: input.category,
      summary: input.summary,
      relevance: input.relevance,
      sourceTaskId: input.sourceTaskId,
      createdAt: new Date().toISOString(),
      tags: input.tags,
      sizeBytes: input.sizeBytes,
      meta: input.meta ?? {}
    };

    try {
      await fs.appendFile(this.manifestPath, JSON.stringify(entry) + "\n", "utf-8");
    } catch (error) {
      // Clean up orphaned artifact to maintain consistency
      await fs.rm(destPath, { force: true }).catch(() => {});
      throw new ResourceCenterError("STORE_WRITE_FAILED", "Failed to write manifest entry", {
        id,
        cause: error instanceof Error ? error.message : String(error)
      });
    }

    return entry;
  }

  async list(): Promise<ResourceEntry[]> {
    try {
      const content = await fs.readFile(this.manifestPath, "utf-8");
      const entries: ResourceEntry[] = [];
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          entries.push(JSON.parse(trimmed) as ResourceEntry);
        } catch {
          // Skip corrupted lines
        }
      }
      return entries;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw new ResourceCenterError("STORE_READ_FAILED", "Failed to read manifest", {
        cause: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async get(id: string): Promise<ResourceEntry | null> {
    const entries = await this.list();
    return entries.find((entry) => entry.id === id) ?? null;
  }

  async search(filter: ResourceQueryFilter): Promise<ResourceEntry[]> {
    let entries = await this.list();

    if (filter.category) {
      entries = entries.filter((entry) => entry.category === filter.category);
    }

    if (filter.tags && filter.tags.length > 0) {
      const filterTags = new Set(filter.tags.map((tag) => tag.toLowerCase()));
      entries = entries.filter((entry) => entry.tags.some((tag) => filterTags.has(tag.toLowerCase())));
    }

    if (filter.keywords && filter.keywords.length > 0) {
      const lowerKeywords = filter.keywords.map((kw) => kw.toLowerCase());
      entries = entries.filter((entry) => {
        const searchText = `${entry.originalName} ${entry.summary} ${entry.tags.join(" ")}`.toLowerCase();
        return lowerKeywords.some((kw) => searchText.includes(kw));
      });
    }

    if (filter.minRelevance !== undefined) {
      entries = entries.filter((entry) => entry.relevance >= filter.minRelevance!);
    }

    entries.sort((a, b) => b.relevance - a.relevance);

    if (filter.limit !== undefined && filter.limit > 0) {
      entries = entries.slice(0, filter.limit);
    }

    return entries;
  }

  async remove(id: string): Promise<boolean> {
    const entries = await this.list();
    const target = entries.find((entry) => entry.id === id);
    if (!target) return false;

    const artifactPath = this.getArtifactPath(target);
    try {
      await fs.rm(artifactPath, { force: true });
    } catch {
      // Artifact may already be missing; proceed with manifest cleanup
    }

    const remaining = entries.filter((entry) => entry.id !== id);
    const content = remaining.map((entry) => JSON.stringify(entry)).join("\n") + (remaining.length > 0 ? "\n" : "");

    try {
      await fs.writeFile(this.manifestPath, content, "utf-8");
    } catch (error) {
      throw new ResourceCenterError("STORE_WRITE_FAILED", "Failed to rewrite manifest after removal", {
        id,
        cause: error instanceof Error ? error.message : String(error)
      });
    }

    return true;
  }

  getArtifactPath(entry: ResourceEntry): string {
    return path.join(this.artifactsDir, entry.storedName);
  }

  private async ensureDirs(): Promise<void> {
    await fs.mkdir(this.artifactsDir, { recursive: true });
  }
}

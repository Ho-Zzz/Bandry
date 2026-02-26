import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ResourceStore } from "../resource-store";
import type { ResourceEntryInput } from "../types";

const TEST_DIR = path.resolve("/tmp/bandry-resource-store-tests");
const RESOURCES_DIR = path.join(TEST_DIR, "resources");

const createInput = (overrides: Partial<ResourceEntryInput> = {}): ResourceEntryInput => ({
  originalName: "report.md",
  category: "document",
  summary: "A test report",
  relevance: 0.8,
  sourceTaskId: "task-1",
  tags: ["test", "report"],
  sizeBytes: 100,
  ...overrides
});

describe("ResourceStore", () => {
  let store: ResourceStore;
  let sourceFile: string;

  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(TEST_DIR, { recursive: true });
    store = new ResourceStore(RESOURCES_DIR);

    // Create a source file for testing
    sourceFile = path.join(TEST_DIR, "source.md");
    await fs.writeFile(sourceFile, "# Test Content\nHello world", "utf-8");
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe("add", () => {
    it("copies artifact and writes manifest entry", async () => {
      const entry = await store.add(createInput(), sourceFile);

      expect(entry.id).toBeTruthy();
      expect(entry.originalName).toBe("report.md");
      expect(entry.storedName).toMatch(/^document-.+\.md$/);
      expect(entry.category).toBe("document");
      expect(entry.createdAt).toBeTruthy();

      // Artifact should exist
      const artifactPath = store.getArtifactPath(entry);
      const content = await fs.readFile(artifactPath, "utf-8");
      expect(content).toBe("# Test Content\nHello world");

      // Manifest should contain the entry
      const manifestPath = path.join(RESOURCES_DIR, "manifest.jsonl");
      const manifest = await fs.readFile(manifestPath, "utf-8");
      const parsed = JSON.parse(manifest.trim());
      expect(parsed.id).toBe(entry.id);
    });
  });

  describe("list", () => {
    it("returns empty array when no manifest exists", async () => {
      const entries = await store.list();
      expect(entries).toEqual([]);
    });

    it("returns all entries from manifest", async () => {
      await store.add(createInput({ originalName: "a.md" }), sourceFile);
      await store.add(createInput({ originalName: "b.json", category: "data" }), sourceFile);

      const entries = await store.list();
      expect(entries).toHaveLength(2);
      expect(entries[0].originalName).toBe("a.md");
      expect(entries[1].originalName).toBe("b.json");
    });

    it("skips corrupted lines in manifest", async () => {
      await store.add(createInput(), sourceFile);

      // Append a corrupted line
      const manifestPath = path.join(RESOURCES_DIR, "manifest.jsonl");
      await fs.appendFile(manifestPath, "not-valid-json\n", "utf-8");
      await store.add(createInput({ originalName: "valid.md" }), sourceFile);

      const entries = await store.list();
      expect(entries).toHaveLength(2);
    });
  });

  describe("get", () => {
    it("returns entry by id", async () => {
      const added = await store.add(createInput(), sourceFile);
      const found = await store.get(added.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(added.id);
    });

    it("returns null for unknown id", async () => {
      const found = await store.get("nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      await store.add(
        createInput({ originalName: "api-docs.md", category: "document", relevance: 0.9, tags: ["api", "docs"] }),
        sourceFile
      );
      await store.add(
        createInput({ originalName: "data.json", category: "data", relevance: 0.5, tags: ["data", "export"] }),
        sourceFile
      );
      await store.add(
        createInput({ originalName: "helper.ts", category: "code", relevance: 0.2, tags: ["util", "code"] }),
        sourceFile
      );
    });

    it("filters by category", async () => {
      const results = await store.search({ category: "document" });
      expect(results).toHaveLength(1);
      expect(results[0].originalName).toBe("api-docs.md");
    });

    it("filters by tags", async () => {
      const results = await store.search({ tags: ["api"] });
      expect(results).toHaveLength(1);
      expect(results[0].originalName).toBe("api-docs.md");
    });

    it("filters by keywords", async () => {
      const results = await store.search({ keywords: ["data"] });
      expect(results).toHaveLength(1);
      expect(results[0].originalName).toBe("data.json");
    });

    it("filters by minRelevance", async () => {
      const results = await store.search({ minRelevance: 0.5 });
      expect(results).toHaveLength(2);
    });

    it("sorts by relevance descending", async () => {
      const results = await store.search({});
      expect(results[0].relevance).toBeGreaterThanOrEqual(results[1].relevance);
      expect(results[1].relevance).toBeGreaterThanOrEqual(results[2].relevance);
    });

    it("respects limit", async () => {
      const results = await store.search({ limit: 1 });
      expect(results).toHaveLength(1);
      expect(results[0].relevance).toBe(0.9);
    });
  });

  describe("remove", () => {
    it("removes entry from manifest and deletes artifact", async () => {
      const entry = await store.add(createInput(), sourceFile);
      const artifactPath = store.getArtifactPath(entry);

      const removed = await store.remove(entry.id);
      expect(removed).toBe(true);

      const entries = await store.list();
      expect(entries).toHaveLength(0);

      await expect(fs.access(artifactPath)).rejects.toThrow();
    });

    it("returns false for unknown id", async () => {
      const removed = await store.remove("nonexistent");
      expect(removed).toBe(false);
    });
  });
});

import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResourceCurationMiddleware } from "../resource-curation";
import type { MiddlewareContext } from "../types";

const TEST_DIR = path.resolve("/tmp/bandry-curation-mw-tests");
const WORKSPACE_DIR = path.join(TEST_DIR, "workspace");
const OUTPUT_DIR = path.join(WORKSPACE_DIR, "output");

const createCtx = (overrides: Partial<MiddlewareContext> = {}): MiddlewareContext => ({
  sessionId: "s1",
  taskId: "t1",
  workspacePath: WORKSPACE_DIR,
  messages: [{ role: "user", content: "生成 API 文档" }],
  tools: [],
  metadata: {},
  state: "after_agent",
  finalResponse: "文档已生成",
  runtime: {
    config: {
      providers: { openai: { apiKey: "sk-openai-valid-key-1234567890", baseUrl: "https://api.openai.com/v1", enabled: true, model: "gpt-4.1-mini" } },
      routing: { assignments: { "lead.synthesizer": "profile_openai_default" } },
      modelProfiles: [{ id: "profile_openai_default", name: "OpenAI", provider: "openai", model: "gpt-4.1-mini", enabled: true, temperature: 0.2 }]
    } as never,
    modelsFactory: {
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4.1-mini",
        text: JSON.stringify([
          {
            fileName: "docs.md",
            shouldTransfer: true,
            category: "document",
            summary: "API documentation",
            relevance: 0.9,
            tags: ["api", "docs"],
            reason: "Valuable reference"
          }
        ]),
        latencyMs: 50
      }))
    } as never,
    sandboxService: {} as never
  },
  ...overrides
});

describe("ResourceCurationMiddleware", () => {
  let mockStore: { add: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    mockStore = {
      add: vi.fn(async () => ({ id: "new-id" }))
    };
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  it("evaluates output files and transfers approved ones", async () => {
    await fs.writeFile(path.join(OUTPUT_DIR, "docs.md"), "# API Docs\nContent here", "utf-8");

    const middleware = new ResourceCurationMiddleware(mockStore as never);
    const result = await middleware.afterAgent!(createCtx());

    expect(result.metadata.resourceCurationEvaluated).toBe(1);
    expect(result.metadata.resourceCurationTransferred).toBe(1);
    expect(mockStore.add).toHaveBeenCalledTimes(1);
    expect(mockStore.add).toHaveBeenCalledWith(
      expect.objectContaining({
        originalName: "docs.md",
        category: "document",
        sourceTaskId: "t1"
      }),
      path.join(OUTPUT_DIR, "docs.md")
    );
  });

  it("returns zero counts when output directory is empty", async () => {
    const middleware = new ResourceCurationMiddleware(mockStore as never);
    const result = await middleware.afterAgent!(createCtx());

    expect(result.metadata.resourceCurationEvaluated).toBe(0);
    expect(result.metadata.resourceCurationTransferred).toBe(0);
  });

  it("returns zero counts when output directory does not exist", async () => {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });

    const middleware = new ResourceCurationMiddleware(mockStore as never);
    const result = await middleware.afterAgent!(createCtx());

    expect(result.metadata.resourceCurationEvaluated).toBe(0);
    expect(result.metadata.resourceCurationTransferred).toBe(0);
  });

  it("returns unchanged context when workspacePath is missing", async () => {
    const middleware = new ResourceCurationMiddleware(mockStore as never);
    const ctx = createCtx({ workspacePath: "" });
    const result = await middleware.afterAgent!(ctx);

    expect(result.metadata.resourceCurationEvaluated).toBeUndefined();
  });

  it("returns unchanged context when runtime is missing", async () => {
    const middleware = new ResourceCurationMiddleware(mockStore as never);
    const ctx = createCtx({ runtime: undefined });
    const result = await middleware.afterAgent!(ctx);

    expect(result.metadata.resourceCurationEvaluated).toBeUndefined();
  });

  it("skips files with path traversal in LLM-returned fileName", async () => {
    await fs.writeFile(path.join(OUTPUT_DIR, "legit.md"), "content", "utf-8");

    const traversalCtx = createCtx({
      runtime: {
        config: createCtx().runtime!.config,
        modelsFactory: {
          generateText: vi.fn(async () => ({
            provider: "openai" as const,
            model: "gpt-4.1-mini",
            text: JSON.stringify([
              {
                fileName: "../../etc/passwd",
                shouldTransfer: true,
                category: "config",
                summary: "Sensitive file",
                relevance: 0.9,
                tags: ["config"],
                reason: "Traversal attempt"
              },
              {
                fileName: "legit.md",
                shouldTransfer: true,
                category: "document",
                summary: "Legit file",
                relevance: 0.8,
                tags: ["doc"],
                reason: "Valid"
              }
            ]),
            latencyMs: 50
          }))
        } as never,
        sandboxService: {} as never
      }
    });

    const middleware = new ResourceCurationMiddleware(mockStore as never);
    const result = await middleware.afterAgent!(traversalCtx);

    // Only the legit file should be transferred, path traversal skipped
    expect(result.metadata.resourceCurationTransferred).toBe(1);
    expect(mockStore.add).toHaveBeenCalledTimes(1);
    expect(mockStore.add).toHaveBeenCalledWith(
      expect.objectContaining({ originalName: "legit.md" }),
      expect.any(String)
    );
  });

  it("handles store add failure gracefully", async () => {
    await fs.writeFile(path.join(OUTPUT_DIR, "docs.md"), "content", "utf-8");

    mockStore.add.mockRejectedValue(new Error("Store write failed"));

    const middleware = new ResourceCurationMiddleware(mockStore as never);
    const result = await middleware.afterAgent!(createCtx());

    expect(result.metadata.resourceCurationEvaluated).toBe(1);
    expect(result.metadata.resourceCurationTransferred).toBe(0);
  });
});

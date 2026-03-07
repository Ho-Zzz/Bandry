import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createDefaultConfig } from "../../config/default-config";
import { CurationJudge } from "../curation-judge";
import type { FilePreview } from "../types";

const createConfig = () => {
  const workspaceDir = path.resolve("/tmp/bandry-curation-tests");
  const config = createDefaultConfig({
    paths: {
      projectRoot: workspaceDir,
      bandryHome: workspaceDir,
      configDir: path.join(workspaceDir, "config"),
      logsDir: path.join(workspaceDir, "logs"),
      workspaceDir,
      workspacesDir: workspaceDir,
      resourcesDir: path.join(workspaceDir, "resources"),
      pluginsDir: path.join(workspaceDir, "plugins"),
      traceDir: path.join(workspaceDir, "traces"),
      skillsDir: path.join(workspaceDir, "skills"),
      soulDir: path.join(workspaceDir, "soul"),
      projectConfigPath: path.join(workspaceDir, "config.json"),
      userConfigPath: path.join(workspaceDir, "user-config.json"),
      auditLogPath: path.join(workspaceDir, "model-audit.log"),
      sandboxAuditLogPath: path.join(workspaceDir, "sandbox-audit.log"),
      databasePath: path.join(workspaceDir, "bandry.db"),
      dotenvPath: path.join(workspaceDir, ".env")
    },
    runtime: {
      inheritedEnv: {}
    }
  });
  config.providers.openai.apiKey = "sk-openai-valid-key-1234567890";
  return config;
};

describe("CurationJudge", () => {
  it("returns empty result for empty file list", async () => {
    const config = createConfig();
    const modelsFactory = { generateText: vi.fn() };
    const judge = new CurationJudge(config, modelsFactory as never);

    const result = await judge.evaluate([], "test task");

    expect(result.evaluatedCount).toBe(0);
    expect(result.transferCount).toBe(0);
    expect(result.judgments).toEqual([]);
    expect(modelsFactory.generateText).not.toHaveBeenCalled();
  });

  it("parses LLM judgments correctly", async () => {
    const config = createConfig();
    const llmResponse = JSON.stringify([
      {
        fileName: "report.md",
        shouldTransfer: true,
        category: "document",
        summary: "Analysis report",
        relevance: 0.8,
        tags: ["report", "analysis"],
        reason: "Valuable reference"
      },
      {
        fileName: "debug.log",
        shouldTransfer: false,
        category: "other",
        summary: "Debug log",
        relevance: 0.1,
        tags: ["log"],
        reason: "Temporary file"
      }
    ]);

    const modelsFactory = {
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4.1-mini",
        text: llmResponse,
        latencyMs: 50
      }))
    };

    const judge = new CurationJudge(config, modelsFactory as never);
    const filePreviews: FilePreview[] = [
      { fileName: "report.md", sizeBytes: 500, preview: "# Report" },
      { fileName: "debug.log", sizeBytes: 2000, preview: "DEBUG: ..." }
    ];

    const result = await judge.evaluate(filePreviews, "test task");

    expect(result.evaluatedCount).toBe(2);
    expect(result.transferCount).toBe(1);
    expect(result.judgments).toHaveLength(2);
    expect(result.judgments[0].shouldTransfer).toBe(true);
    expect(result.judgments[1].shouldTransfer).toBe(false);
    expect(modelsFactory.generateText).toHaveBeenCalledTimes(1);
  });

  it("returns empty result on LLM failure", async () => {
    const config = createConfig();
    const modelsFactory = {
      generateText: vi.fn(async () => {
        throw new Error("API error");
      })
    };

    const judge = new CurationJudge(config, modelsFactory as never);
    const filePreviews: FilePreview[] = [
      { fileName: "test.md", sizeBytes: 100, preview: "content" }
    ];

    const result = await judge.evaluate(filePreviews, "test task");

    expect(result.evaluatedCount).toBe(1);
    expect(result.transferCount).toBe(0);
    expect(result.judgments).toEqual([]);
  });

  it("filters out entries with invalid category values", async () => {
    const config = createConfig();
    const llmResponse = JSON.stringify([
      {
        fileName: "valid.md",
        shouldTransfer: true,
        category: "document",
        summary: "Valid doc",
        relevance: 0.8,
        tags: ["doc"],
        reason: "Good"
      },
      {
        fileName: "invalid.md",
        shouldTransfer: true,
        category: "report",
        summary: "Invalid category",
        relevance: 0.7,
        tags: ["report"],
        reason: "Bad category"
      }
    ]);

    const modelsFactory = {
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4.1-mini",
        text: llmResponse,
        latencyMs: 50
      }))
    };

    const judge = new CurationJudge(config, modelsFactory as never);
    const filePreviews: FilePreview[] = [
      { fileName: "valid.md", sizeBytes: 100, preview: "content" },
      { fileName: "invalid.md", sizeBytes: 100, preview: "content" }
    ];

    const result = await judge.evaluate(filePreviews, "test task");

    expect(result.judgments).toHaveLength(1);
    expect(result.judgments[0].fileName).toBe("valid.md");
    expect(result.transferCount).toBe(1);
  });

  it("passes abortSignal to generateText", async () => {
    const config = createConfig();
    const controller = new AbortController();
    const modelsFactory = {
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4.1-mini",
        text: "[]",
        latencyMs: 50
      }))
    };

    const judge = new CurationJudge(config, modelsFactory as never);
    const filePreviews: FilePreview[] = [
      { fileName: "test.md", sizeBytes: 100, preview: "content" }
    ];

    await judge.evaluate(filePreviews, "test task", controller.signal);

    expect(modelsFactory.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: controller.signal
      })
    );
  });

  it("handles malformed LLM response gracefully", async () => {
    const config = createConfig();
    const modelsFactory = {
      generateText: vi.fn(async () => ({
        provider: "openai" as const,
        model: "gpt-4.1-mini",
        text: "This is not valid JSON at all",
        latencyMs: 50
      }))
    };

    const judge = new CurationJudge(config, modelsFactory as never);
    const filePreviews: FilePreview[] = [
      { fileName: "test.md", sizeBytes: 100, preview: "content" }
    ];

    const result = await judge.evaluate(filePreviews, "test task");

    expect(result.evaluatedCount).toBe(1);
    expect(result.transferCount).toBe(0);
    expect(result.judgments).toEqual([]);
  });
});

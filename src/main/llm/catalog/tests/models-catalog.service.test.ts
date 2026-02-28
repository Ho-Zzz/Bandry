import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadAppConfig } from "../../../config";
import { ModelsCatalogService } from "../models-catalog.service";

const createConfig = (bandryHome: string) => {
  return loadAppConfig({
    cwd: "/Users/bytedance/Workspace/hozzz/Bandry",
    userHome: bandryHome,
    env: {
      ...process.env,
      BANDRY_HOME: bandryHome
    },
    skipDotenv: true
  });
};

describe("ModelsCatalogService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads catalog from file source and keeps executable providers only", async () => {
    const bandryHome = path.join(os.tmpdir(), `bandry-catalog-${Date.now()}`);
    const catalogFile = path.join(bandryHome, "catalog.json");
    await fs.mkdir(path.dirname(catalogFile), { recursive: true });
    await fs.writeFile(
      catalogFile,
      JSON.stringify({
        providers: [
          {
            id: "openai",
            name: "OpenAI",
            models: [
              {
                id: "gpt-4.1-mini",
                name: "GPT 4.1 Mini",
                tool_call: true,
                modalities: ["text"]
              },
              {
                id: "text-embedding-3-large",
                name: "Text Embedding 3 Large",
                task: "embedding"
              }
            ]
          },
          {
            id: "openrouter",
            name: "OpenRouter",
            models: [{ id: "openai/gpt-4o-mini", name: "GPT 4o Mini" }]
          },
          {
            id: "anthropic",
            name: "Anthropic",
            models: [{ id: "claude-sonnet", name: "Claude Sonnet" }]
          }
        ]
      }),
      "utf8"
    );

    const config = createConfig(bandryHome);
    config.catalog.source = {
      type: "file",
      location: catalogFile,
      schema: "models.dev",
      timeoutMs: 5000
    };

    const service = new ModelsCatalogService(config);
    const result = await service.list();

    expect(result.sourceType).toBe("file");
    expect(result.providers).toHaveLength(2);
    expect(result.providers[0].id).toBe("openai");
    expect(result.providers[0].models[0].capabilities.toolCall).toBe(true);
    expect(result.providers[0].models[1].capabilities.isEmbeddingModel).toBe(true);
    expect(result.providers.some((provider) => provider.id === "openrouter")).toBe(true);
  });

  it("throws source error when http source is unavailable", async () => {
    const bandryHome = path.join(os.tmpdir(), `bandry-catalog-http-${Date.now()}`);
    const config = createConfig(bandryHome);
    config.catalog.source = {
      type: "http",
      location: "https://catalog.example.invalid/api.json",
      schema: "models.dev",
      timeoutMs: 5000
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );

    const service = new ModelsCatalogService(config);
    await expect(service.list()).rejects.toMatchObject({
      code: "CATALOG_SOURCE_UNAVAILABLE"
    });
  });

  it("throws schema error when payload does not include providers", async () => {
    const bandryHome = path.join(os.tmpdir(), `bandry-catalog-schema-${Date.now()}`);
    const config = createConfig(bandryHome);
    config.catalog.source = {
      type: "http",
      location: "https://catalog.example.invalid/api.json",
      schema: "models.dev",
      timeoutMs: 5000
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return {
          ok: true,
          json: async () => ({ foo: "bar" })
        } as Response;
      })
    );

    const service = new ModelsCatalogService(config);
    await expect(service.list()).rejects.toMatchObject({
      code: "CATALOG_SCHEMA_INVALID"
    });
  });
});

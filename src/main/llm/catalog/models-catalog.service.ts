import type {
  CatalogModelItem,
  CatalogModelCapabilities,
  ModelsCatalogListInput,
  ModelsCatalogListResult,
  ModelsCatalogProvider
} from "../../../shared/ipc";
import type { AppConfig } from "../../config";
import { createCatalogSource } from "./catalog-source-factory";
import { parseModelsDevPayload } from "./models-dev.schema";
import { toSupportedProvider } from "./provider-alias";

export type CatalogErrorCode = "CATALOG_SOURCE_UNAVAILABLE" | "CATALOG_SCHEMA_INVALID";

export class CatalogServiceError extends Error {
  constructor(
    readonly code: CatalogErrorCode,
    message: string
  ) {
    super(message);
    this.name = "CatalogServiceError";
  }
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const getBoolean = (record: Record<string, unknown>, keys: string[]): boolean => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      return value > 0;
    }
  }
  return false;
};

const getNumber = (record: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
};

const getNestedNumber = (record: Record<string, unknown>, path: string): number | undefined => {
  const parts = path.split(".");
  let cursor: unknown = record;
  for (const part of parts) {
    const cursorRecord = asRecord(cursor);
    if (!cursorRecord || !(part in cursorRecord)) {
      return undefined;
    }
    cursor = cursorRecord[part];
  }

  if (typeof cursor === "number" && Number.isFinite(cursor)) {
    return cursor;
  }

  return undefined;
};

const getStringArray = (record: Record<string, unknown>, keys: string[]): string[] => {
  for (const key of keys) {
    const value = record[key];
    if (!Array.isArray(value)) {
      continue;
    }

    const normalized = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return [];
};

const getString = (record: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().toLowerCase();
    }
  }
  return undefined;
};

const inferEmbeddingModel = (raw: Record<string, unknown>): boolean => {
  if (getBoolean(raw, ["embedding", "is_embedding", "supports_embedding", "supports_embeddings"])) {
    return true;
  }

  const task = getString(raw, ["task", "type", "model_type"]);
  if (task && task.includes("embedding")) {
    return true;
  }

  const id = getString(raw, ["id", "model", "name"]);
  return Boolean(id && id.includes("embedding"));
};

const buildCapabilities = (raw: Record<string, unknown>): CatalogModelCapabilities => {
  const modalities = getStringArray(raw, [
    "modalities",
    "input_modalities",
    "output_modalities"
  ]);

  return {
    toolCall: getBoolean(raw, [
      "tool_call",
      "toolCall",
      "tool_calling",
      "supports_tools",
      "supports_tool_calling"
    ]),
    reasoning: getBoolean(raw, [
      "reasoning",
      "supports_reasoning"
    ]),
    inputModalities: modalities.length > 0 ? modalities : ["text"],
    outputModalities: modalities.length > 0 ? modalities : ["text"],
    isEmbeddingModel: inferEmbeddingModel(raw)
  };
};

const buildCatalogModel = (
  provider: CatalogModelItem["provider"],
  model: {
    id: string;
    name: string;
    raw: Record<string, unknown>;
  }
): CatalogModelItem => {
  const contextWindow =
    getNumber(model.raw, ["context_window", "contextWindow", "context_length"]) ??
    getNestedNumber(model.raw, "limit.context") ??
    getNestedNumber(model.raw, "limits.context");
  const maxOutputTokens =
    getNumber(model.raw, ["max_output_tokens", "maxOutputTokens", "output_tokens"]) ??
    getNestedNumber(model.raw, "limit.output") ??
    getNestedNumber(model.raw, "limits.output");

  return {
    id: model.id,
    name: model.name,
    provider,
    capabilities: buildCapabilities(model.raw),
    contextWindow,
    maxOutputTokens
  };
};

export class ModelsCatalogService {
  private cached: ModelsCatalogListResult | null = null;

  constructor(private readonly config: AppConfig) {}

  async list(input: ModelsCatalogListInput = {}): Promise<ModelsCatalogListResult> {
    if (!input.refresh && this.cached) {
      return this.cached;
    }

    const source = createCatalogSource(this.config);
    let fetched: Awaited<ReturnType<typeof source.fetch>>;
    try {
      fetched = await source.fetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown source error";
      throw new CatalogServiceError(
        "CATALOG_SOURCE_UNAVAILABLE",
        `Failed to fetch model catalog from source: ${message}`
      );
    }

    const parsed = (() => {
      try {
        return parseModelsDevPayload(fetched.payload);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown schema parse error";
        throw new CatalogServiceError(
          "CATALOG_SCHEMA_INVALID",
          `Catalog source payload is invalid: ${message}`
        );
      }
    })();
    if (parsed.providers.length === 0) {
      throw new CatalogServiceError(
        "CATALOG_SCHEMA_INVALID",
        "Catalog payload does not contain any providers"
      );
    }

    const providersMap = new Map<ModelsCatalogProvider["id"], ModelsCatalogProvider>();
    for (const providerNode of parsed.providers) {
      const providerId = toSupportedProvider(providerNode.id);
      if (!providerId) {
        continue;
      }

      const models = providerNode.models
        .map((model) => buildCatalogModel(providerId, model))
        .sort((a, b) => a.id.localeCompare(b.id));

      if (models.length === 0) {
        continue;
      }

      providersMap.set(providerId, {
        id: providerId,
        name: providerNode.name || providerId,
        models
      });
    }

    const result: ModelsCatalogListResult = {
      sourceType: fetched.sourceType,
      sourceLocation: fetched.sourceLocation,
      fetchedAt: fetched.fetchedAt,
      providers: Array.from(providersMap.values()).sort((a, b) => a.id.localeCompare(b.id))
    };

    this.cached = result;
    return result;
  }
}

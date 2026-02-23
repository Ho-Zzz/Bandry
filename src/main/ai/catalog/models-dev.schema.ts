import { z } from "zod";

const ModelsDevProviderArrayRootSchema = z.object({
  providers: z.array(z.unknown())
}).passthrough();

const ModelsDevDataRootSchema = z.object({
  data: z.object({
    providers: z.array(z.unknown())
  }).passthrough()
}).passthrough();

export const ModelsDevPayloadSchema = z.union([
  ModelsDevProviderArrayRootSchema,
  ModelsDevDataRootSchema,
  z.array(z.unknown()),
  z.record(z.string(), z.unknown())
]);

type ParsedProviderNode = {
  id: string;
  name: string;
  modelsNode: unknown;
};

type ParsedModelNode = {
  id: string;
  name: string;
  raw: Record<string, unknown>;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
};

const pickString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
};

const extractProviderFromArrayEntry = (entry: unknown): ParsedProviderNode | null => {
  const record = asRecord(entry);
  if (!record) {
    return null;
  }

  const id = pickString(record.id) ?? pickString(record.provider) ?? pickString(record.name);
  if (!id) {
    return null;
  }

  return {
    id,
    name: pickString(record.name) ?? id,
    modelsNode: record.models ?? []
  };
};

const extractProviderEntries = (payload: unknown): ParsedProviderNode[] => {
  const rootRecord = asRecord(payload);

  if (Array.isArray(payload)) {
    return payload
      .map(extractProviderFromArrayEntry)
      .filter((item): item is ParsedProviderNode => item !== null);
  }

  if (Array.isArray(rootRecord?.providers)) {
    return rootRecord.providers
      .map(extractProviderFromArrayEntry)
      .filter((item): item is ParsedProviderNode => item !== null);
  }

  const dataProviders = asRecord(rootRecord?.data)?.providers;
  if (Array.isArray(dataProviders)) {
    return dataProviders
      .map(extractProviderFromArrayEntry)
      .filter((item): item is ParsedProviderNode => item !== null);
  }

  if (!rootRecord) {
    return [];
  }

  return Object.entries(rootRecord).flatMap(([providerId, providerNode]) => {
    const providerRecord = asRecord(providerNode);
    if (!providerRecord) {
      return [];
    }

    if (!("models" in providerRecord)) {
      return [];
    }

    return [
      {
        id: pickString(providerRecord.id) ?? providerId,
        name: pickString(providerRecord.name) ?? providerId,
        modelsNode: providerRecord.models
      }
    ];
  });
};

const extractModelFromArrayEntry = (entry: unknown): ParsedModelNode | null => {
  const record = asRecord(entry);
  if (!record) {
    return null;
  }

  const id = pickString(record.id) ?? pickString(record.model) ?? pickString(record.name);
  if (!id) {
    return null;
  }

  return {
    id,
    name: pickString(record.name) ?? id,
    raw: record
  };
};

const extractModels = (modelsNode: unknown): ParsedModelNode[] => {
  if (Array.isArray(modelsNode)) {
    return modelsNode
      .map(extractModelFromArrayEntry)
      .filter((item): item is ParsedModelNode => item !== null);
  }

  const modelsRecord = asRecord(modelsNode);
  if (!modelsRecord) {
    return [];
  }

  return Object.entries(modelsRecord).flatMap(([modelId, node]) => {
    const record = asRecord(node);
    if (!record) {
      return [];
    }

    return [
      {
        id: pickString(record.id) ?? modelId,
        name: pickString(record.name) ?? modelId,
        raw: record
      }
    ];
  });
};

export type ParsedModelsDevCatalog = {
  providers: Array<{
    id: string;
    name: string;
    models: ParsedModelNode[];
  }>;
};

export const parseModelsDevPayload = (payload: unknown): ParsedModelsDevCatalog => {
  const parsed = ModelsDevPayloadSchema.parse(payload);
  const providers = extractProviderEntries(parsed).map((provider) => ({
    id: provider.id,
    name: provider.name,
    models: extractModels(provider.modelsNode)
  }));

  return {
    providers
  };
};

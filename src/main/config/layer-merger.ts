import type { AppConfig, ConfigLayer, LlmProvider, ProviderLayerConfig } from "./types";
import { resolveProviderName } from "./provider-resolver";

const applyProviderLayer = (target: AppConfig, providerName: LlmProvider, providerLayer: ProviderLayerConfig): void => {
  const provider = target.providers[providerName];

  if (providerLayer.enabled !== undefined) {
    provider.enabled = providerLayer.enabled;
  }
  if (providerLayer.apiKey !== undefined) {
    provider.apiKey = providerLayer.apiKey;
  }
  if (providerLayer.baseUrl !== undefined) {
    provider.baseUrl = providerLayer.baseUrl;
  }
  if (providerLayer.model !== undefined) {
    provider.model = providerLayer.model;
  }
  if (providerLayer.embeddingModel !== undefined) {
    provider.embeddingModel = providerLayer.embeddingModel;
  }
  if (providerName === "openai" && providerLayer.orgId !== undefined) {
    provider.orgId = providerLayer.orgId;
  }
};

export const applyLayer = (target: AppConfig, layer: ConfigLayer): void => {
  if (layer.llm) {
    const llmLayer = layer.llm;

    if (llmLayer.defaultProvider !== undefined) {
      target.llm.defaultProvider = resolveProviderName(llmLayer.defaultProvider);
    }
    if (llmLayer.defaultModel !== undefined) {
      target.llm.defaultModel = llmLayer.defaultModel;
    }
    if (llmLayer.timeoutMs !== undefined) {
      target.llm.timeoutMs = llmLayer.timeoutMs;
    }
    if (llmLayer.maxRetries !== undefined) {
      target.llm.maxRetries = llmLayer.maxRetries;
    }
    if (llmLayer.retryBaseMs !== undefined) {
      target.llm.retryBaseMs = llmLayer.retryBaseMs;
    }
    if (llmLayer.rateLimitRps !== undefined) {
      target.llm.rateLimitRps = llmLayer.rateLimitRps;
    }
    if (llmLayer.networkMode !== undefined) {
      target.llm.networkMode = llmLayer.networkMode;
    }
    if (llmLayer.offlineNonModelOnly !== undefined) {
      target.llm.offlineNonModelOnly = llmLayer.offlineNonModelOnly;
    }
    if (llmLayer.auditLogEnabled !== undefined) {
      target.llm.auditLogEnabled = llmLayer.auditLogEnabled;
    }
    if (llmLayer.piiRedactionEnabled !== undefined) {
      target.llm.piiRedactionEnabled = llmLayer.piiRedactionEnabled;
    }
  }

  if (layer.sandbox) {
    const sandboxLayer = layer.sandbox;

    if (sandboxLayer.virtualRoot !== undefined) {
      target.sandbox.virtualRoot = sandboxLayer.virtualRoot;
    }
    if (sandboxLayer.allowedWorkspaces !== undefined) {
      target.sandbox.allowedWorkspaces = sandboxLayer.allowedWorkspaces;
    }
    if (sandboxLayer.allowedCommands !== undefined) {
      target.sandbox.allowedCommands = sandboxLayer.allowedCommands;
    }
    if (sandboxLayer.execTimeoutMs !== undefined) {
      target.sandbox.execTimeoutMs = sandboxLayer.execTimeoutMs;
    }
    if (sandboxLayer.maxOutputBytes !== undefined) {
      target.sandbox.maxOutputBytes = sandboxLayer.maxOutputBytes;
    }
    if (sandboxLayer.auditLogEnabled !== undefined) {
      target.sandbox.auditLogEnabled = sandboxLayer.auditLogEnabled;
    }
  }

  if (layer.features) {
    const featuresLayer = layer.features;

    if (featuresLayer.enableMemory !== undefined) {
      target.features.enableMemory = featuresLayer.enableMemory;
    }
    if (featuresLayer.enableMCP !== undefined) {
      target.features.enableMCP = featuresLayer.enableMCP;
    }
  }

  if (layer.openviking) {
    const openvikingLayer = layer.openviking;

    if (openvikingLayer.enabled !== undefined) {
      target.openviking.enabled = openvikingLayer.enabled;
    }
    if (openvikingLayer.host !== undefined) {
      target.openviking.host = openvikingLayer.host;
    }
    if (openvikingLayer.port !== undefined) {
      target.openviking.port = openvikingLayer.port;
    }
    if (openvikingLayer.apiKey !== undefined) {
      target.openviking.apiKey = openvikingLayer.apiKey;
    }
    if (openvikingLayer.vlmProfileId !== undefined) {
      target.openviking.vlmProfileId = openvikingLayer.vlmProfileId;
    }
    if (openvikingLayer.embeddingProfileId !== undefined) {
      target.openviking.embeddingProfileId = openvikingLayer.embeddingProfileId;
    }
    if (openvikingLayer.serverCommand !== undefined) {
      target.openviking.serverCommand = openvikingLayer.serverCommand;
    }
    if (openvikingLayer.serverArgs !== undefined) {
      target.openviking.serverArgs = openvikingLayer.serverArgs;
    }
    if (openvikingLayer.startTimeoutMs !== undefined) {
      target.openviking.startTimeoutMs = openvikingLayer.startTimeoutMs;
    }
    if (openvikingLayer.healthcheckIntervalMs !== undefined) {
      target.openviking.healthcheckIntervalMs = openvikingLayer.healthcheckIntervalMs;
    }
    if (openvikingLayer.memoryTopK !== undefined) {
      target.openviking.memoryTopK = openvikingLayer.memoryTopK;
    }
    if (openvikingLayer.memoryScoreThreshold !== undefined) {
      target.openviking.memoryScoreThreshold = openvikingLayer.memoryScoreThreshold;
    }
    if (openvikingLayer.commitDebounceMs !== undefined) {
      target.openviking.commitDebounceMs = openvikingLayer.commitDebounceMs;
    }
    if (openvikingLayer.targetUris !== undefined) {
      target.openviking.targetUris = openvikingLayer.targetUris;
    }
  }

  if (layer.paths) {
    const pathsLayer = layer.paths;

    if (pathsLayer.bandryHome !== undefined) {
      target.paths.bandryHome = pathsLayer.bandryHome;
    }
    if (pathsLayer.configDir !== undefined) {
      target.paths.configDir = pathsLayer.configDir;
    }
    if (pathsLayer.logsDir !== undefined) {
      target.paths.logsDir = pathsLayer.logsDir;
    }
    if (pathsLayer.workspaceDir !== undefined) {
      target.paths.workspaceDir = pathsLayer.workspaceDir;
    }
    if (pathsLayer.workspacesDir !== undefined) {
      target.paths.workspacesDir = pathsLayer.workspacesDir;
    }
    if (pathsLayer.resourcesDir !== undefined) {
      target.paths.resourcesDir = pathsLayer.resourcesDir;
    }
    if (pathsLayer.pluginsDir !== undefined) {
      target.paths.pluginsDir = pathsLayer.pluginsDir;
    }
    if (pathsLayer.traceDir !== undefined) {
      target.paths.traceDir = pathsLayer.traceDir;
    }
    if (pathsLayer.databasePath !== undefined) {
      target.paths.databasePath = pathsLayer.databasePath;
    }
    if (pathsLayer.auditLogPath !== undefined) {
      target.paths.auditLogPath = pathsLayer.auditLogPath;
    }
    if (pathsLayer.sandboxAuditLogPath !== undefined) {
      target.paths.sandboxAuditLogPath = pathsLayer.sandboxAuditLogPath;
    }
  }

  if (layer.catalog?.source) {
    const catalogLayer = layer.catalog.source;
    if (catalogLayer.type !== undefined) {
      target.catalog.source.type = catalogLayer.type;
    }
    if (catalogLayer.location !== undefined) {
      target.catalog.source.location = catalogLayer.location;
    }
    if (catalogLayer.schema !== undefined) {
      target.catalog.source.schema = catalogLayer.schema;
    }
    if (catalogLayer.timeoutMs !== undefined) {
      target.catalog.source.timeoutMs = catalogLayer.timeoutMs;
    }
  }

  if (layer.modelProfiles !== undefined) {
    const mergedById = new Map(target.modelProfiles.map((profile) => [profile.id, { ...profile }]));
    for (const profileLayer of layer.modelProfiles) {
      const existing = mergedById.get(profileLayer.id) ?? {
        id: profileLayer.id,
        name: profileLayer.id,
        provider: "openai" as const,
        model: "",
        enabled: true
      };

      mergedById.set(profileLayer.id, {
        ...existing,
        ...(profileLayer.name !== undefined ? { name: profileLayer.name } : {}),
        ...(profileLayer.provider !== undefined ? { provider: resolveProviderName(profileLayer.provider) } : {}),
        ...(profileLayer.model !== undefined ? { model: profileLayer.model } : {}),
        ...(profileLayer.enabled !== undefined ? { enabled: profileLayer.enabled } : {}),
        ...(profileLayer.temperature !== undefined ? { temperature: profileLayer.temperature } : {}),
        ...(profileLayer.maxTokens !== undefined ? { maxTokens: profileLayer.maxTokens } : {})
      });
    }
    target.modelProfiles = Array.from(mergedById.values());
  }

  if (layer.routing?.assignments) {
    for (const [role, profileId] of Object.entries(layer.routing.assignments)) {
      if (typeof profileId !== "string") {
        continue;
      }
      target.routing.assignments[role as keyof AppConfig["routing"]["assignments"]] = profileId;
    }
  }

  if (layer.tools?.webSearch) {
    const source = layer.tools.webSearch;
    if (source.enabled !== undefined) {
      target.tools.webSearch.enabled = source.enabled;
    }
    if (source.provider !== undefined) {
      target.tools.webSearch.provider = source.provider;
    }
    if (source.apiKey !== undefined) {
      target.tools.webSearch.apiKey = source.apiKey;
    }
    if (source.baseUrl !== undefined) {
      target.tools.webSearch.baseUrl = source.baseUrl;
    }
    if (source.timeoutMs !== undefined) {
      target.tools.webSearch.timeoutMs = source.timeoutMs;
    }
    if (source.maxResults !== undefined) {
      target.tools.webSearch.maxResults = source.maxResults;
    }
  }

  if (layer.tools?.webFetch) {
    const source = layer.tools.webFetch;
    if (source.enabled !== undefined) {
      target.tools.webFetch.enabled = source.enabled;
    }
    if (source.provider !== undefined) {
      target.tools.webFetch.provider = source.provider;
    }
    if (source.apiKey !== undefined) {
      target.tools.webFetch.apiKey = source.apiKey;
    }
    if (source.baseUrl !== undefined) {
      target.tools.webFetch.baseUrl = source.baseUrl;
    }
    if (source.timeoutMs !== undefined) {
      target.tools.webFetch.timeoutMs = source.timeoutMs;
    }
  }

  if (!layer.providers) {
    return;
  }

  for (const [rawName, providerLayer] of Object.entries(layer.providers)) {
    if (!providerLayer) {
      continue;
    }

    const providerName = resolveProviderName(rawName);
    applyProviderLayer(target, providerName, providerLayer);
  }
};

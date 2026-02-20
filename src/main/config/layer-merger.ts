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

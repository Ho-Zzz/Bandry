import fs from "node:fs";
import type { ConfigLayer } from "./types";
import { isKnownProvider } from "./provider-resolver";
import {
  asObject,
  toBooleanValue,
  toNetworkMode,
  toNumberValue,
  toStringListValue,
  toStringValue
} from "./value-parsers";

export const readJsonLayer = (filePath: string): ConfigLayer => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const text = fs.readFileSync(filePath, "utf8").trim();
  if (!text) {
    return {};
  }

  const parsed = JSON.parse(text) as unknown;
  const root = asObject(parsed);

  const llmRaw = asObject(root.llm);
  const sandboxRaw = asObject(root.sandbox);
  type LlmLayer = NonNullable<ConfigLayer["llm"]>;
  const llmLayer: ConfigLayer["llm"] = {
    defaultProvider: toStringValue(llmRaw.defaultProvider) as LlmLayer["defaultProvider"] | undefined,
    defaultModel: toStringValue(llmRaw.defaultModel),
    timeoutMs: toNumberValue(llmRaw.timeoutMs),
    maxRetries: toNumberValue(llmRaw.maxRetries),
    retryBaseMs: toNumberValue(llmRaw.retryBaseMs),
    rateLimitRps: toNumberValue(llmRaw.rateLimitRps),
    networkMode: toNetworkMode(llmRaw.networkMode),
    offlineNonModelOnly: toBooleanValue(llmRaw.offlineNonModelOnly),
    auditLogEnabled: toBooleanValue(llmRaw.auditLogEnabled),
    piiRedactionEnabled: toBooleanValue(llmRaw.piiRedactionEnabled)
  };

  const sandboxLayer: ConfigLayer["sandbox"] = {
    virtualRoot: toStringValue(sandboxRaw.virtualRoot),
    allowedWorkspaces: toStringListValue(sandboxRaw.allowedWorkspaces),
    allowedCommands: toStringListValue(sandboxRaw.allowedCommands),
    execTimeoutMs: toNumberValue(sandboxRaw.execTimeoutMs),
    maxOutputBytes: toNumberValue(sandboxRaw.maxOutputBytes),
    auditLogEnabled: toBooleanValue(sandboxRaw.auditLogEnabled)
  };

  const providerRoot = asObject(root.providers);
  const providers: ConfigLayer["providers"] = {};
  for (const [rawName, rawConfig] of Object.entries(providerRoot)) {
    if (!isKnownProvider(rawName)) {
      continue;
    }

    const providerConfig = asObject(rawConfig);
    const name = rawName.toLowerCase() as keyof NonNullable<ConfigLayer["providers"]>;
    providers[name] = {
      enabled: toBooleanValue(providerConfig.enabled),
      apiKey: toStringValue(providerConfig.apiKey),
      baseUrl: toStringValue(providerConfig.baseUrl),
      model: toStringValue(providerConfig.model),
      orgId: toStringValue(providerConfig.orgId)
    };
  }

  return {
    llm: llmLayer,
    sandbox: sandboxLayer,
    providers
  };
};

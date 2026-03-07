import fs from "node:fs";
import type { ConfigLayer, LlmProvider } from "./types";
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
  const featuresRaw = asObject(root.features);
  const openvikingRaw = asObject(root.openviking);
  const pathsRaw = asObject(root.paths);
  const catalogRaw = asObject(root.catalog);
  const catalogSourceRaw = asObject(catalogRaw.source);
  const routingRaw = asObject(root.routing);
  const toolsRaw = asObject(root.tools);
  const channelsRaw = asObject(root.channels);
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

  const featuresLayer: ConfigLayer["features"] = {
    enableMemory: toBooleanValue(featuresRaw.enableMemory),
    enableMCP: toBooleanValue(featuresRaw.enableMCP)
  };

  const openvikingLayer: ConfigLayer["openviking"] = {
    enabled: toBooleanValue(openvikingRaw.enabled),
    host: toStringValue(openvikingRaw.host),
    port: toNumberValue(openvikingRaw.port),
    apiKey: toStringValue(openvikingRaw.apiKey),
    vlmProfileId: toStringValue(openvikingRaw.vlmProfileId),
    embeddingProfileId: toStringValue(openvikingRaw.embeddingProfileId),
    serverCommand: toStringValue(openvikingRaw.serverCommand),
    serverArgs: toStringListValue(openvikingRaw.serverArgs),
    startTimeoutMs: toNumberValue(openvikingRaw.startTimeoutMs),
    healthcheckIntervalMs: toNumberValue(openvikingRaw.healthcheckIntervalMs),
    memoryTopK: toNumberValue(openvikingRaw.memoryTopK),
    memoryScoreThreshold: toNumberValue(openvikingRaw.memoryScoreThreshold),
    commitDebounceMs: toNumberValue(openvikingRaw.commitDebounceMs),
    targetUris: toStringListValue(openvikingRaw.targetUris)
  };

  const pathsLayer: ConfigLayer["paths"] = {
    bandryHome: toStringValue(pathsRaw.bandryHome),
    configDir: toStringValue(pathsRaw.configDir),
    logsDir: toStringValue(pathsRaw.logsDir),
    workspaceDir: toStringValue(pathsRaw.workspaceDir),
    workspacesDir: toStringValue(pathsRaw.workspacesDir),
    resourcesDir: toStringValue(pathsRaw.resourcesDir),
    pluginsDir: toStringValue(pathsRaw.pluginsDir),
    traceDir: toStringValue(pathsRaw.traceDir),
    databasePath: toStringValue(pathsRaw.databasePath),
    auditLogPath: toStringValue(pathsRaw.auditLogPath),
    sandboxAuditLogPath: toStringValue(pathsRaw.sandboxAuditLogPath)
  };

  const catalogLayer: ConfigLayer["catalog"] = {
    source: {
      type: toStringValue(catalogSourceRaw.type) as "http" | "file" | undefined,
      location: toStringValue(catalogSourceRaw.location),
      schema: toStringValue(catalogSourceRaw.schema) as "models.dev" | undefined,
      timeoutMs: toNumberValue(catalogSourceRaw.timeoutMs)
    }
  };

  const modelProfilesLayer: ConfigLayer["modelProfiles"] = Array.isArray(root.modelProfiles)
    ? root.modelProfiles
        .map((item) => asObject(item))
        .map((item) => ({
          id: toStringValue(item.id) ?? "",
          name: toStringValue(item.name),
          provider: toStringValue(item.provider) as LlmProvider | undefined,
          model: toStringValue(item.model),
          enabled: toBooleanValue(item.enabled),
          temperature: toNumberValue(item.temperature),
          maxTokens: toNumberValue(item.maxTokens)
        }))
        .filter((item) => item.id.trim().length > 0)
    : undefined;

  const routingAssignmentsRaw = asObject(routingRaw.assignments);
  const routingLayer: ConfigLayer["routing"] = {
    assignments: {
      "chat.default": toStringValue(routingAssignmentsRaw["chat.default"]),
      "lead.planner": toStringValue(routingAssignmentsRaw["lead.planner"]),
      "lead.synthesizer": toStringValue(routingAssignmentsRaw["lead.synthesizer"]),
      "sub.researcher": toStringValue(routingAssignmentsRaw["sub.researcher"]),
      "sub.bash_operator": toStringValue(routingAssignmentsRaw["sub.bash_operator"]),
      "sub.writer": toStringValue(routingAssignmentsRaw["sub.writer"]),
      "memory.fact_extractor": toStringValue(routingAssignmentsRaw["memory.fact_extractor"])
    }
  };

  const webSearchRaw = asObject(toolsRaw.webSearch);
  const webFetchRaw = asObject(toolsRaw.webFetch);
  const githubSearchRaw = asObject(toolsRaw.githubSearch);
  const toolsLayer: ConfigLayer["tools"] = {
    webSearch: {
      enabled: toBooleanValue(webSearchRaw.enabled),
      provider: toStringValue(webSearchRaw.provider) as "tavily" | undefined,
      apiKey: toStringValue(webSearchRaw.apiKey),
      baseUrl: toStringValue(webSearchRaw.baseUrl),
      timeoutMs: toNumberValue(webSearchRaw.timeoutMs),
      maxResults: toNumberValue(webSearchRaw.maxResults)
    },
    webFetch: {
      enabled: toBooleanValue(webFetchRaw.enabled),
      provider: toStringValue(webFetchRaw.provider) as "jina" | undefined,
      apiKey: toStringValue(webFetchRaw.apiKey),
      baseUrl: toStringValue(webFetchRaw.baseUrl),
      timeoutMs: toNumberValue(webFetchRaw.timeoutMs)
    },
    githubSearch: {
      enabled: toBooleanValue(githubSearchRaw.enabled),
      apiKey: toStringValue(githubSearchRaw.apiKey),
      baseUrl: toStringValue(githubSearchRaw.baseUrl),
      timeoutMs: toNumberValue(githubSearchRaw.timeoutMs),
      maxResults: toNumberValue(githubSearchRaw.maxResults)
    }
  };

  const channelsLayer: ConfigLayer["channels"] = {
    enabled: toBooleanValue(channelsRaw.enabled),
    channels: Array.isArray(channelsRaw.channels)
      ? channelsRaw.channels
          .map((item) => asObject(item))
          .map((item) => ({
            id: toStringValue(item.id),
            name: toStringValue(item.name),
            type: toStringValue(item.type) ?? "feishu",
            appId: toStringValue(item.appId),
            appSecret: toStringValue(item.appSecret),
            allowedChatIds: toStringListValue(item.allowedChatIds),
            enabled: toBooleanValue(item.enabled)
          }))
      : undefined
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
      embeddingModel: toStringValue(providerConfig.embeddingModel),
      orgId: toStringValue(providerConfig.orgId)
    };
  }

  return {
    llm: llmLayer,
    sandbox: sandboxLayer,
    features: featuresLayer,
    openviking: openvikingLayer,
    paths: pathsLayer,
    catalog: catalogLayer,
    modelProfiles: modelProfilesLayer,
    routing: routingLayer,
    tools: toolsLayer,
    channels: channelsLayer,
    providers
  };
};

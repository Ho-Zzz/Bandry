import path from "node:path";
import type { AppConfig } from "./types";

const normalizePath = (value: string): string => path.resolve(value.trim() || ".");
const normalizeProviderBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.replace(/\/chat\/completions$/i, "");
};
const RUNTIME_ROLES: Array<keyof AppConfig["routing"]["assignments"]> = [
  "chat.default",
  "lead.planner",
  "lead.synthesizer",
  "sub.researcher",
  "sub.bash_operator",
  "sub.writer",
  "memory.fact_extractor"
];

export const normalizeConfig = (config: AppConfig): AppConfig => {
  config.paths.projectRoot = normalizePath(config.paths.projectRoot);
  config.paths.bandryHome = normalizePath(config.paths.bandryHome);
  config.paths.configDir = normalizePath(config.paths.configDir);
  config.paths.logsDir = normalizePath(config.paths.logsDir);
  config.paths.workspacesDir = normalizePath(config.paths.workspacesDir);
  config.paths.workspaceDir = normalizePath(config.paths.workspaceDir || config.paths.workspacesDir);
  config.paths.resourcesDir = normalizePath(config.paths.resourcesDir);
  config.paths.pluginsDir = normalizePath(config.paths.pluginsDir);
  config.paths.traceDir = normalizePath(config.paths.traceDir);
  config.paths.projectConfigPath = normalizePath(config.paths.projectConfigPath);
  config.paths.userConfigPath = normalizePath(config.paths.userConfigPath);
  config.paths.auditLogPath = normalizePath(config.paths.auditLogPath);
  config.paths.sandboxAuditLogPath = normalizePath(config.paths.sandboxAuditLogPath);
  config.paths.databasePath = normalizePath(config.paths.databasePath);
  config.paths.dotenvPath = normalizePath(config.paths.dotenvPath);

  if (config.catalog.source.type !== "http" && config.catalog.source.type !== "file") {
    config.catalog.source.type = "http";
  }
  config.catalog.source.location = config.catalog.source.location.trim();
  if (!config.catalog.source.location) {
    config.catalog.source.location = "https://models.dev/api.json";
  }
  config.catalog.source.schema = "models.dev";
  config.catalog.source.timeoutMs = Math.max(1_000, Math.floor(config.catalog.source.timeoutMs));

  config.llm.timeoutMs = Math.max(1_000, Math.floor(config.llm.timeoutMs));
  config.llm.maxRetries = Math.max(0, Math.floor(config.llm.maxRetries));
  config.llm.retryBaseMs = Math.max(100, Math.floor(config.llm.retryBaseMs));
  config.llm.rateLimitRps = Math.max(0.1, config.llm.rateLimitRps);

  config.sandbox.execTimeoutMs = Math.max(1_000, Math.floor(config.sandbox.execTimeoutMs));
  config.sandbox.maxOutputBytes = Math.max(1_024, Math.floor(config.sandbox.maxOutputBytes));
  config.sandbox.virtualRoot = config.sandbox.virtualRoot.trim() || "/mnt/workspace";
  if (!config.sandbox.virtualRoot.startsWith("/")) {
    config.sandbox.virtualRoot = `/${config.sandbox.virtualRoot}`;
  }
  config.sandbox.virtualRoot = config.sandbox.virtualRoot.replace(/\/+$/, "") || "/mnt/workspace";

  config.sandbox.allowedWorkspaces = Array.from(new Set(config.sandbox.allowedWorkspaces.map((value) => path.resolve(value))));
  if (config.sandbox.allowedWorkspaces.length === 0) {
    config.sandbox.allowedWorkspaces = [config.paths.workspaceDir];
  }
  if (!config.sandbox.allowedWorkspaces.includes(config.paths.workspaceDir)) {
    config.sandbox.allowedWorkspaces.push(config.paths.workspaceDir);
  }

  config.sandbox.allowedCommands = Array.from(
    new Set(
      config.sandbox.allowedCommands
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );
  if (config.sandbox.allowedCommands.length === 0) {
    config.sandbox.allowedCommands = ["ls", "cat", "mkdir", "echo"];
  }

  if (!config.llm.defaultModel) {
    config.llm.defaultModel = config.providers[config.llm.defaultProvider].model;
  }

  config.openviking.host = config.openviking.host.trim() || "127.0.0.1";
  config.openviking.port = Math.max(1, Math.min(65535, Math.floor(config.openviking.port)));
  config.openviking.serverCommand = config.openviking.serverCommand.trim() || "openviking";
  config.openviking.serverArgs = config.openviking.serverArgs.map((arg) => arg.trim()).filter(Boolean);
  if (config.openviking.serverArgs.length === 0) {
    config.openviking.serverArgs = ["serve"];
  }
  config.openviking.startTimeoutMs = Math.max(1_000, Math.floor(config.openviking.startTimeoutMs));
  config.openviking.healthcheckIntervalMs = Math.max(100, Math.floor(config.openviking.healthcheckIntervalMs));
  config.openviking.memoryTopK = Math.max(1, Math.floor(config.openviking.memoryTopK));
  config.openviking.memoryScoreThreshold = Math.max(0, Math.min(1, config.openviking.memoryScoreThreshold));
  config.openviking.commitDebounceMs = Math.max(500, Math.floor(config.openviking.commitDebounceMs));
  config.openviking.targetUris = Array.from(
    new Set(config.openviking.targetUris.map((uri) => uri.trim()).filter(Boolean))
  );
  if (config.openviking.targetUris.length === 0) {
    config.openviking.targetUris = ["viking://user/memories", "viking://agent/memories"];
  }

  for (const provider of Object.values(config.providers)) {
    provider.baseUrl = normalizeProviderBaseUrl(provider.baseUrl);
  }

  const normalizedProfiles = new Map<string, AppConfig["modelProfiles"][number]>();
  for (const profile of config.modelProfiles) {
    const id = profile.id.trim();
    if (!id) {
      continue;
    }
    const model = (profile.model ?? "").trim();
    if (!model) {
      continue;
    }
    normalizedProfiles.set(id, {
      ...profile,
      id,
      name: profile.name.trim() || id,
      model,
      enabled: profile.enabled !== false,
      temperature:
        profile.temperature === undefined
          ? undefined
          : Math.max(0, Math.min(2, profile.temperature)),
      maxTokens:
        profile.maxTokens === undefined
          ? undefined
          : Math.max(1, Math.floor(profile.maxTokens))
    });
  }
  config.modelProfiles = Array.from(normalizedProfiles.values());

  for (const role of RUNTIME_ROLES) {
    const current = config.routing.assignments[role]?.trim() ?? "";
    config.routing.assignments[role] = current && normalizedProfiles.has(current) ? current : "";
  }
  config.routing.assignments["memory.fact_extractor"] =
    config.routing.assignments["lead.synthesizer"] ||
    config.routing.assignments["lead.planner"] ||
    config.routing.assignments["chat.default"] ||
    "";

  config.tools.webSearch.enabled = Boolean(config.tools.webSearch.enabled);
  config.tools.webSearch.provider = "tavily";
  config.tools.webSearch.baseUrl = config.tools.webSearch.baseUrl.trim() || "https://api.tavily.com";
  config.tools.webSearch.timeoutMs = Math.max(500, Math.floor(config.tools.webSearch.timeoutMs));
  config.tools.webSearch.maxResults = Math.max(1, Math.min(20, Math.floor(config.tools.webSearch.maxResults)));

  config.tools.webFetch.enabled = Boolean(config.tools.webFetch.enabled);
  config.tools.webFetch.provider = "jina";
  config.tools.webFetch.baseUrl = config.tools.webFetch.baseUrl.trim() || "https://r.jina.ai/http://";
  config.tools.webFetch.timeoutMs = Math.max(500, Math.floor(config.tools.webFetch.timeoutMs));

  config.channels.channels = config.channels.channels.filter(
    (ch) => ch.type && ch.appId && ch.appSecret
  );

  config.runtime.devServerUrl = config.runtime.devServerUrl?.trim() || undefined;
  config.runtime.inheritedEnv = Object.fromEntries(
    Object.entries(config.runtime.inheritedEnv)
      .map(([key, value]) => [key, String(value)])
      .filter(([, value]) => value.length > 0)
  );

  return config;
};

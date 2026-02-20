import path from "node:path";
import type { AppConfig } from "./types";

export const normalizeConfig = (config: AppConfig): AppConfig => {
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

  for (const provider of Object.values(config.providers)) {
    provider.baseUrl = provider.baseUrl.replace(/\/+$/, "");
  }

  return config;
};

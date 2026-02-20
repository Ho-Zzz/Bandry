import os from "node:os";
import path from "node:path";
import dotenv from "dotenv";
import { createDefaultConfig } from "./default-config";
import { envToLayer } from "./env-layer";
import { applyLayer } from "./layer-merger";
import { normalizeConfig } from "./normalize-config";
import { readJsonLayer } from "./json-layer-reader";
import { toPublicConfigSummary } from "./public-config-summary";
import type { AppConfig } from "./types";

type LoadAppConfigOptions = {
  cwd?: string;
  userHome?: string;
  env?: NodeJS.ProcessEnv;
  skipDotenv?: boolean;
};

export const loadAppConfig = (options: LoadAppConfigOptions = {}): AppConfig => {
  const workspaceDir = options.cwd ?? process.cwd();
  const userHome = options.userHome ?? os.homedir();
  const projectConfigPath = path.join(workspaceDir, "config.json");
  const userConfigPath = path.join(userHome, ".config", "bandry", "config.json");
  const auditLogPath = path.join(userHome, ".bandry", "logs", "model-audit.log");
  const sandboxAuditLogPath = path.join(userHome, ".bandry", "logs", "sandbox-audit.log");
  const databasePath = path.join(userHome, ".bandry", "config", "bandry.db");
  const traceDir = path.join(userHome, ".bandry", "traces");
  const resourcesDir = path.join(userHome, ".bandry", "resources");
  const envPath = path.join(workspaceDir, ".env");

  if (!options.skipDotenv) {
    dotenv.config({ path: envPath, override: false, quiet: true });
  }

  const env = options.env ?? process.env;
  const config = createDefaultConfig({
    workspaceDir,
    projectConfigPath,
    userConfigPath,
    auditLogPath,
    sandboxAuditLogPath,
    databasePath,
    traceDir,
    resourcesDir
  });

  // Keep strict precedence: project -> user -> env.
  applyLayer(config, readJsonLayer(projectConfigPath));
  applyLayer(config, readJsonLayer(userConfigPath));
  applyLayer(config, envToLayer(env));

  if (!config.llm.defaultModel) {
    config.llm.defaultModel = config.providers[config.llm.defaultProvider].model;
  }

  return normalizeConfig(config);
};

export { toPublicConfigSummary };

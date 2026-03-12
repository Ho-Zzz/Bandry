import os from "node:os";
import { createDefaultConfig } from "./default-config";
import { applyLayer } from "./layer-merger";
import { normalizeConfig } from "./normalize-config";
import { resolvePathPlan } from "./path-resolver";
import { readJsonLayer } from "./json-layer-reader";
import { toPublicConfigSummary } from "./public-config-summary";
import type { AppConfig, ConfigLayer } from "./types";

type LoadAppConfigOptions = {
  cwd?: string;
  userHome?: string;
  env?: NodeJS.ProcessEnv;
};

const toInheritedEnv = (env: NodeJS.ProcessEnv): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      result[key] = value;
    }
  }
  return result;
};

const applyLayerFiles = (config: AppConfig, paths: string[]): void => {
  for (const filePath of paths) {
    applyLayer(config, readJsonLayer(filePath));
  }
};

const pickUserOwnedModelLayer = (layer: ConfigLayer): ConfigLayer => {
  const llmDefaults = layer.llm
    ? {
        defaultProvider: layer.llm.defaultProvider,
        defaultModel: layer.llm.defaultModel
      }
    : undefined;

  return {
    llm: llmDefaults,
    providers: layer.providers,
    modelProfiles: layer.modelProfiles,
    routing: layer.routing,
    tools: layer.tools
  };
};

const applyUserOwnedModelLayers = (config: AppConfig, paths: string[]): void => {
  for (const filePath of paths) {
    const layer = readJsonLayer(filePath);
    applyLayer(config, pickUserOwnedModelLayer(layer));
  }
};

export const loadAppConfig = (options: LoadAppConfigOptions = {}): AppConfig => {
  const cwd = options.cwd ?? process.cwd();
  const userHome = options.userHome ?? os.homedir();

  const env = options.env ?? process.env;
  const inheritedEnv = toInheritedEnv({
    PATH: env.PATH ?? process.env.PATH
  });
  const plan = resolvePathPlan({
    cwd,
    userHome
  });

  const config = createDefaultConfig({
    paths: plan.paths,
    runtime: {
      devServerUrl: env.VITE_DEV_SERVER_URL,
      inheritedEnv
    }
  });

  // Base precedence: default -> project -> user.
  applyLayerFiles(config, plan.projectLayerPaths);
  applyLayerFiles(config, plan.userLayerPaths);
  applyUserOwnedModelLayers(config, plan.userLayerPaths);

  if (!config.llm.defaultModel) {
    config.llm.defaultModel = config.providers[config.llm.defaultProvider].model;
  }

  config.runtime.devServerUrl = env.VITE_DEV_SERVER_URL;
  config.runtime.inheritedEnv = inheritedEnv;

  return normalizeConfig(config);
};

export { toPublicConfigSummary };

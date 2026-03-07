import fs from "node:fs";
import path from "node:path";
import type { AppConfig } from "./types";

const buildInitialUserConfigLayer = (config: AppConfig): object => {
  const providers = Object.fromEntries(
    Object.entries(config.providers).map(([provider, item]) => [
      provider,
      {
        enabled: item.enabled,
        apiKey: "",
        baseUrl: item.baseUrl,
        model: item.model,
        embeddingModel: item.embeddingModel,
        ...(item.orgId !== undefined ? { orgId: item.orgId } : {})
      }
    ])
  );

  return {
    llm: {
      defaultProvider: config.llm.defaultProvider,
      defaultModel: config.llm.defaultModel
    },
    providers,
    features: {
      enableMemory: config.features.enableMemory
    },
    openviking: {
      ...config.openviking,
      apiKey: ""
    },
    modelProfiles: config.modelProfiles.map((profile) => ({ ...profile })),
    routing: {
      assignments: { ...config.routing.assignments }
    },
    tools: {
      webSearch: {
        ...config.tools.webSearch,
        apiKey: ""
      },
      webFetch: {
        ...config.tools.webFetch,
        apiKey: ""
      },
      githubSearch: {
        ...config.tools.githubSearch,
        apiKey: ""
      }
    },
    channels: {
      enabled: config.channels.enabled,
      channels: config.channels.channels.map((channel) => ({
        ...channel,
        appSecret: ""
      }))
    },
    catalog: {
      source: {
        type: config.catalog.source.type,
        location: config.catalog.source.location,
        schema: config.catalog.source.schema,
        timeoutMs: config.catalog.source.timeoutMs
      }
    }
  };
};

export const ensureUserConfigFile = (config: AppConfig): void => {
  const targetPath = config.paths.userConfigPath;
  if (fs.existsSync(targetPath)) {
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(buildInitialUserConfigLayer(config), null, 2)}\n`, "utf8");
};


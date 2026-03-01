import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../config";
import { hasUsableProviderApiKey } from "../../config/provider-credential";

type BuildOpenVikingConfigInput = {
  config: AppConfig;
  host: string;
  port: number;
  agfsPort: number;
  apiKey: string;
  dataDir: string;
};

type DenseEmbeddingConfig = {
  model: string;
  api_key: string;
  api_base: string;
  dimension: number;
  provider: "openai" | "volcengine";
  input: "multimodal" | "text";
};

type OpenVikingProvider = "openai" | "volcengine";

type BoundProfileConfig = {
  provider: OpenVikingProvider;
  model: string;
  apiKey: string;
  apiBase: string;
};

const resolveBoundProfileConfig = (
  config: AppConfig,
  profileId: string,
  fieldName: "vlmProfileId" | "embeddingProfileId"
): BoundProfileConfig => {
  const normalizedId = profileId.trim();
  if (!normalizedId) {
    throw new Error(`openviking.${fieldName} is required`);
  }

  const profile = config.modelProfiles.find((item) => item.id === normalizedId);
  if (!profile) {
    throw new Error(`openviking.${fieldName} references unknown profile: ${normalizedId}`);
  }
  if (!profile.enabled) {
    throw new Error(`openviking.${fieldName} references disabled profile: ${normalizedId}`);
  }
  if (profile.provider !== "openai" && profile.provider !== "volcengine") {
    throw new Error(`openviking.${fieldName} only supports openai/volcengine profile: ${normalizedId}`);
  }

  const providerConfig = config.providers[profile.provider];
  if (!hasUsableProviderApiKey(profile.provider, providerConfig.apiKey)) {
    throw new Error(`openviking.${fieldName} provider credential is invalid: ${profile.provider}`);
  }

  return {
    provider: profile.provider,
    model: profile.model,
    apiKey: providerConfig.apiKey,
    apiBase: providerConfig.baseUrl
  };
};

const resolveEmbeddingDimension = (provider: OpenVikingProvider, model: string): number => {
  if (provider === "openai" && model === "text-embedding-3-large") {
    return 3072;
  }
  if (provider === "volcengine" && model === "doubao-embedding-vision-250615") {
    return 1024;
  }
  return 1024;
};

const buildDenseEmbeddingConfig = (profile: BoundProfileConfig): DenseEmbeddingConfig => {
  return {
    model: profile.model,
    api_key: profile.apiKey,
    api_base: profile.apiBase,
    dimension: resolveEmbeddingDimension(profile.provider, profile.model),
    provider: profile.provider,
    input: profile.provider === "volcengine" ? "multimodal" : "text"
  };
};

export const buildOpenVikingConfig = (input: BuildOpenVikingConfigInput): Record<string, unknown> => {
  const vlm = resolveBoundProfileConfig(input.config, input.config.openviking.vlmProfileId, "vlmProfileId");
  const embedding = resolveBoundProfileConfig(
    input.config,
    input.config.openviking.embeddingProfileId,
    "embeddingProfileId"
  );
  const denseEmbedding = buildDenseEmbeddingConfig(embedding);

  return {
    default_account: "bandry",
    default_user: "default",
    default_agent: "bandry-agent",
    server: {
      host: input.host,
      port: input.port,
      root_api_key: input.apiKey,
      cors_origins: ["*"]
    },
    storage: {
      workspace: input.dataDir
    },
    log: {
      level: "INFO",
      output: "stdout"
    },
    embedding: {
      dense: denseEmbedding
    },
    vlm: {
      model: vlm.model,
      api_key: vlm.apiKey,
      api_base: vlm.apiBase,
      temperature: 0,
      max_retries: 2,
      provider: vlm.provider,
      thinking: false
    }
  };
};

export const writeOpenVikingConfig = async (
  configPath: string,
  input: BuildOpenVikingConfigInput
): Promise<void> => {
  const text = JSON.stringify(buildOpenVikingConfig(input), null, 2);
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, text, "utf8");
};

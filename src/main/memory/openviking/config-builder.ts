import fs from "node:fs/promises";
import path from "node:path";
import type { AppConfig } from "../../config";

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

const buildDenseEmbeddingConfig = (config: AppConfig): DenseEmbeddingConfig => {
  const volcengine = config.providers.volcengine;
  if (volcengine.apiKey.trim().length > 0) {
    return {
      model: "doubao-embedding-vision-250615",
      api_key: volcengine.apiKey,
      api_base: volcengine.baseUrl,
      dimension: 1024,
      provider: "volcengine",
      input: "multimodal"
    };
  }

  const openai = config.providers.openai;
  return {
    model: "text-embedding-3-large",
    api_key: openai.apiKey,
    api_base: openai.baseUrl,
    dimension: 3072,
    provider: "openai",
    input: "text"
  };
};

export const buildOpenVikingConfig = (input: BuildOpenVikingConfigInput): Record<string, unknown> => {
  const vlmProvider = input.config.llm.defaultProvider;
  const vlmConfig = input.config.providers[vlmProvider];
  const denseEmbedding = buildDenseEmbeddingConfig(input.config);

  return {
    default_account: "bandry",
    default_user: "default",
    default_agent: "bandry-agent",
    server: {
      host: input.host,
      port: input.port,
      api_key: input.apiKey,
      cors_origins: ["*"]
    },
    storage: {
      vectordb: {
        name: "context",
        backend: "local",
        path: input.dataDir
      },
      agfs: {
        port: input.agfsPort,
        log_level: "warn",
        path: input.dataDir,
        backend: "local"
      }
    },
    embedding: {
      dense: denseEmbedding
    },
    vlm: {
      model: vlmConfig.model,
      api_key: vlmConfig.apiKey,
      api_base: vlmConfig.baseUrl,
      temperature: 0,
      max_retries: 2,
      provider: vlmProvider,
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

export const MODEL_PROVIDERS = [
  "openai",
  "deepseek",
  "volcengine",
  "openrouter",
  "groq",
  "moonshot",
  "qwen",
  "siliconflow",
  "together"
] as const;

export type ModelProvider = (typeof MODEL_PROVIDERS)[number];

export const MODEL_PROVIDER_NAME_MAP: Record<ModelProvider, string> = {
  openai: "OpenAI",
  deepseek: "DeepSeek",
  volcengine: "Volcengine",
  openrouter: "OpenRouter",
  groq: "Groq",
  moonshot: "Moonshot",
  qwen: "Qwen",
  siliconflow: "SiliconFlow",
  together: "Together AI"
};

export type ModelProviderDefaults = {
  baseUrl: string;
  model: string;
  embeddingModel: string;
  orgId?: string;
};

export const MODEL_PROVIDER_DEFAULTS: Record<ModelProvider, ModelProviderDefaults> = {
  openai: {
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4.1-mini",
    embeddingModel: "text-embedding-3-large",
    orgId: ""
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    embeddingModel: ""
  },
  volcengine: {
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    model: "doubao-seed-1-6-250615",
    embeddingModel: "doubao-embedding-vision-250615"
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
    embeddingModel: ""
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.1-8b-instant",
    embeddingModel: ""
  },
  moonshot: {
    baseUrl: "https://api.moonshot.cn/v1",
    model: "moonshot-v1-8k",
    embeddingModel: ""
  },
  qwen: {
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    embeddingModel: ""
  },
  siliconflow: {
    baseUrl: "https://api.siliconflow.cn/v1",
    model: "Qwen/Qwen2.5-7B-Instruct",
    embeddingModel: ""
  },
  together: {
    baseUrl: "https://api.together.xyz/v1",
    model: "meta-llama/Llama-3.1-8B-Instruct-Turbo",
    embeddingModel: ""
  }
};

export const isModelProvider = (value: string): value is ModelProvider => {
  return (MODEL_PROVIDERS as readonly string[]).includes(value);
};

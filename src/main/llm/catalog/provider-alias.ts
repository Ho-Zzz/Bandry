import type { ModelProvider } from "../../../shared/ipc";

const normalize = (value: string): string => {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, "");
};

const ALIASES: Array<{
  canonical: ModelProvider;
  aliases: string[];
}> = [
  {
    canonical: "openai",
    aliases: ["openai"]
  },
  {
    canonical: "deepseek",
    aliases: ["deepseek", "deepseekai"]
  },
  {
    canonical: "volcengine",
    aliases: ["volcengine", "volc", "ark", "bytedance", "doubao"]
  },
  {
    canonical: "openrouter",
    aliases: ["openrouter"]
  },
  {
    canonical: "groq",
    aliases: ["groq", "groqcloud"]
  },
  {
    canonical: "moonshot",
    aliases: ["moonshot", "kimi", "moonshotai"]
  },
  {
    canonical: "qwen",
    aliases: ["qwen", "dashscope", "aliyun", "tongyi"]
  },
  {
    canonical: "siliconflow",
    aliases: ["siliconflow", "silicon"]
  },
  {
    canonical: "together",
    aliases: ["together", "togetherai"]
  }
];

export const toSupportedProvider = (raw: string): ModelProvider | null => {
  const normalized = normalize(raw);
  if (!normalized) {
    return null;
  }

  for (const item of ALIASES) {
    if (item.aliases.some((alias) => normalize(alias) === normalized)) {
      return item.canonical;
    }
  }

  return null;
};

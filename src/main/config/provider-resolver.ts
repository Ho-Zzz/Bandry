import type { LlmProvider } from "./types";

const KNOWN_PROVIDERS = new Set(["openai", "deepseek", "volcengine", "bytedance"]);

export const isKnownProvider = (value: string): boolean => KNOWN_PROVIDERS.has(value.toLowerCase());

export const resolveProviderName = (raw: string | undefined): LlmProvider => {
  if (!raw) {
    return "openai";
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "bytedance") {
    return "volcengine";
  }

  if (normalized === "openai" || normalized === "deepseek" || normalized === "volcengine") {
    return normalized;
  }

  return "openai";
};

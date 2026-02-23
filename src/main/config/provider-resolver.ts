import type { LlmProvider } from "./types";
import { isModelProvider, MODEL_PROVIDERS } from "../../shared/model-providers";

const KNOWN_PROVIDERS = new Set([...MODEL_PROVIDERS, "bytedance"]);

export const isKnownProvider = (value: string): boolean => KNOWN_PROVIDERS.has(value.toLowerCase());

export const resolveProviderName = (raw: string | undefined): LlmProvider => {
  if (!raw) {
    return "openai";
  }

  const normalized = raw.trim().toLowerCase();
  if (normalized === "bytedance") {
    return "volcengine";
  }

  if (isModelProvider(normalized)) {
    return normalized;
  }

  return "openai";
};

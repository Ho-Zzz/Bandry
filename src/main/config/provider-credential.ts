import type { LlmProvider } from "./types";

const OPENAI_KEY_PATTERN = /^sk-[A-Za-z0-9_-]{16,}$/;
const DEEPSEEK_KEY_PATTERN = /^sk-[A-Za-z0-9_-]{16,}$/;

export const hasUsableProviderApiKey = (
  provider: LlmProvider,
  apiKey: string
): boolean => {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return false;
  }

  if (provider === "openai") {
    return OPENAI_KEY_PATTERN.test(trimmed);
  }

  if (provider === "deepseek") {
    return DEEPSEEK_KEY_PATTERN.test(trimmed);
  }

  // Volcengine key styles vary (endpoint / token). Non-empty is the safe baseline.
  return true;
};

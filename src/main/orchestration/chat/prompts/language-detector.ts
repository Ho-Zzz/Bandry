import type { DetectedLanguage } from "./types";

/**
 * Detect the primary language of the input text.
 * Returns "zh" for Chinese, "en" for English, or "auto" if unclear.
 */
export const detectLanguage = (text: string): DetectedLanguage => {
  if (!text || text.trim().length === 0) {
    return "auto";
  }

  // Match Chinese characters (CJK Unified Ideographs)
  const chinesePattern = /[\u4e00-\u9fff]/g;
  const chineseMatches = text.match(chinesePattern) || [];

  // Remove whitespace for character ratio calculation
  const totalChars = text.replace(/\s/g, "").length;

  if (totalChars === 0) {
    return "auto";
  }

  const chineseRatio = chineseMatches.length / totalChars;

  // If more than 30% Chinese characters, treat as Chinese
  if (chineseRatio > 0.3) {
    return "zh";
  }

  // If less than 10% Chinese characters, treat as English
  if (chineseRatio < 0.1) {
    return "en";
  }

  // Mixed content - let the model decide
  return "auto";
};

/**
 * Get language hint for response style section
 */
export const getLanguageHint = (language: DetectedLanguage): string => {
  switch (language) {
    case "zh":
      return "Respond in Chinese (中文) to match the user's input language.";
    case "en":
      return "Respond in English to match the user's input language.";
    default:
      return "Respond in the same language as the user's input.";
  }
};

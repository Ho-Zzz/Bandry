import { buildSection } from "../template-engine";
import type { DetectedLanguage } from "../types";
import { getLanguageHint } from "../language-detector";

/**
 * Build the response style section
 * @param userLanguage Detected user language for response consistency
 */
export const buildResponseStyleSection = (userLanguage: DetectedLanguage = "auto"): string => {
  const languageHint = getLanguageHint(userLanguage);

  const content = `- Clear and Concise: Avoid over-formatting unless requested
- Natural Tone: Use paragraphs and prose, not bullet points by default
- Action-Oriented: Focus on delivering results, not explaining processes
- Language Consistency: ${languageHint}`;

  return buildSection("response_style", content);
};

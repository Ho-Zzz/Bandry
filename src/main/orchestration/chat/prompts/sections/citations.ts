import { buildSection } from "../template-engine";

/**
 * Build the citations section for web search results
 */
export const buildCitationsSection = (): string => {
  const content = `- When to Use: After web_search, include citations if applicable
- Format: Use Markdown link format \`[citation:TITLE](URL)\`
- Example:
\`\`\`markdown
The key AI trends for 2026 include enhanced reasoning capabilities
[citation:AI Trends 2026](https://techcrunch.com/ai-trends).
\`\`\``;

  return buildSection("citations", content);
};

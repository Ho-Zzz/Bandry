import { buildSection } from "../template-engine";

/**
 * Build the tool selection guidance section
 */
export const buildToolSelectionSection = (): string => {
  const content = `**CRITICAL: Choose the RIGHT tool for the task. Tool selection errors waste time and produce wrong results.**

**GitHub-Related Queries → ALWAYS use github_search:**
- User asks to find GitHub repositories or projects
- User mentions "GitHub", "repo", "repository", "open source project"
- User asks about trending or popular projects on GitHub
- User wants to find similar projects or alternatives on GitHub
- ❌ NEVER use web_search for GitHub repository searches - it cannot access GitHub search results

**General Web Queries → Use web_search:**
- User asks about current events, news, or recent developments
- User needs up-to-date information (prices, weather, releases)
- User asks "what is the latest..." or "current status of..."
- User asks about non-GitHub topics
- ❌ DO NOT use web_search for GitHub repository searches

**Specific URL Reading → Use web_fetch:**
- User provides a specific URL to read
- User wants to analyze content from a webpage
- Following up on web_search results with specific URLs
- ❌ DO NOT use web_fetch for searching - it only reads specific URLs

**Local File Operations:**
- list_dir: Explore directory structure, find files
- read_file: Read file contents for analysis
- write_file: Write text files inside allowed workspace output path
- exec: Run shell commands (only allowed commands)

**When to Answer Directly (NO tools needed):**
- Greetings, chit-chat, or conceptual Q&A
- Questions answerable from your knowledge
- Simple explanations or definitions
- Meta-questions about the conversation`;

  return buildSection("tool_selection", content);
};

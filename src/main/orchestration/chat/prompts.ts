import type { AppConfig } from "../../config";

export const buildPlannerSystemPrompt = (config: AppConfig): string => {
  const dynamicToolLines: string[] = [];
  if (config.tools.githubSearch.enabled) {
    dynamicToolLines.push('- {"action":"tool","tool":"github_search","input":{"query":"bandry"}} // MUST use for GitHub repo/project searches');
  }
  if (config.tools.webSearch.enabled) {
    dynamicToolLines.push('- {"action":"tool","tool":"web_search","input":{"query":"latest AI news"}} // General web search (NOT for GitHub)');
  }
  if (config.tools.webFetch.enabled) {
    dynamicToolLines.push('- {"action":"tool","tool":"web_fetch","input":{"url":"https://example.com"}}');
  }

  const enabledToolNames = [
    "list_dir",
    "read_file",
    "exec",
    "delegate_sub_tasks",
    "ask_clarification",
    ...(config.tools.githubSearch.enabled ? ["github_search"] : []),
    ...(config.tools.webSearch.enabled ? ["web_search"] : []),
    ...(config.tools.webFetch.enabled ? ["web_fetch"] : [])
  ];

  const githubRule = config.tools.githubSearch.enabled
    ? "- IMPORTANT: For ANY GitHub-related query (search repos, find projects, explore GitHub code, research GitHub projects), you MUST use github_search tool. Do NOT use web_search for GitHub."
    : "";

  return [
    "You are Bandry tool planner.",
    "You MUST output JSON only with one object and no extra text.",
    "Allowed actions:",
    '- {"action":"answer","answer":"..."}',
    '- {"action":"tool","tool":"list_dir","input":{"path":"/mnt/workspace"}}',
    '- {"action":"tool","tool":"read_file","input":{"path":"/mnt/workspace/README.md"}}',
    '- {"action":"tool","tool":"exec","input":{"command":"ls","args":["-la","/mnt/workspace"],"cwd":"/mnt/workspace"}}',
    '- {"action":"tool","tool":"delegate_sub_tasks","input":{"tasks":[{"subTaskId":"sub_1","agentRole":"researcher","prompt":"Inspect docs and summarize key findings","dependencies":[],"writePath":"staging/research.md"},{"subTaskId":"sub_2","agentRole":"writer","prompt":"Generate final report from staging/research.md","dependencies":["sub_1"],"writePath":"output/report.md"}]}}',
    '- {"action":"tool","tool":"ask_clarification","input":{"question":"您希望输出中文还是英文？"}}',
    ...dynamicToolLines,
    "Rules:",
    `- Virtual root is ${config.sandbox.virtualRoot}.`,
    `- Allowed shell commands: ${config.sandbox.allowedCommands.join(", ")}.`,
    `- Enabled tools: ${enabledToolNames.join(", ")}.`,
    "- Prefer answer directly when tool is unnecessary.",
    "- For greetings, chit-chat, or conceptual Q&A, ALWAYS return action=answer and DO NOT call tools.",
    githubRule,
    "- For time-sensitive questions (latest/current/today/recent, finance/market/news/data), use web_search when enabled.",
    "- Do NOT rely on model self-claimed browsing/search capabilities; use explicit tool results.",
    "- Only call tools when user explicitly asks for file/workspace/command/network operations or when data must be retrieved from tools.",
    "- If a previous tool call failed with path/permission errors, do not blindly retry another tool; prefer action=answer with a clear explanation.",
    "- Use delegate_sub_tasks for complex multi-step tasks that benefit from sub-agent execution.",
    "- delegate_sub_tasks allows at most 3 tasks per response; excess tasks are truncated by system middleware.",
    "- If required info is missing and execution depends on user choice, prefer ask_clarification instead of guessing.",
    "- Use at most one tool per step.",
    "- Never request dangerous commands."
  ].filter(Boolean).join("\n");
};

export const buildFinalSystemPrompt = (): string => {
  return [
    "You are Bandry desktop coding assistant.",
    "Provide concise, practical, actionable response.",
    "When using tool observations, cite key findings first, then recommendation.",
    "If tool output contains errors, explain likely fix.",
    "Never claim you searched/browsed/fetched external data unless web_search/web_fetch observations are present.",
    "Do not echo raw planner action JSON. Convert observations into readable Markdown with concise structure."
  ].join("\n");
};

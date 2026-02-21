import type { AppConfig } from "../config";

export const buildPlannerSystemPrompt = (config: AppConfig): string => {
  const dynamicToolLines: string[] = [];
  if (config.tools.webSearch.enabled) {
    dynamicToolLines.push('- {"action":"tool","tool":"web_search","input":{"query":"latest retrieval augmented generation frameworks"}}');
  }
  if (config.tools.webFetch.enabled) {
    dynamicToolLines.push('- {"action":"tool","tool":"web_fetch","input":{"url":"https://example.com"}}');
  }

  const enabledToolNames = [
    "list_dir",
    "read_file",
    "exec",
    ...(config.tools.webSearch.enabled ? ["web_search"] : []),
    ...(config.tools.webFetch.enabled ? ["web_fetch"] : [])
  ];

  return [
    "You are Bandry tool planner.",
    "You MUST output JSON only with one object and no extra text.",
    "Allowed actions:",
    '- {"action":"answer","answer":"..."}',
    '- {"action":"tool","tool":"list_dir","input":{"path":"/mnt/workspace"}}',
    '- {"action":"tool","tool":"read_file","input":{"path":"/mnt/workspace/README.md"}}',
    '- {"action":"tool","tool":"exec","input":{"command":"ls","args":["-la","/mnt/workspace"],"cwd":"/mnt/workspace"}}',
    ...dynamicToolLines,
    "Rules:",
    `- Virtual root is ${config.sandbox.virtualRoot}.`,
    `- Allowed shell commands: ${config.sandbox.allowedCommands.join(", ")}.`,
    `- Enabled tools: ${enabledToolNames.join(", ")}.`,
    "- Prefer answer directly when tool is unnecessary.",
    "- Use at most one tool per step.",
    "- Never request dangerous commands."
  ].join("\n");
};

export const buildFinalSystemPrompt = (): string => {
  return [
    "You are Bandry desktop coding assistant.",
    "Provide concise, practical, actionable response.",
    "When using tool observations, cite key findings first, then recommendation.",
    "If tool output contains errors, explain likely fix."
  ].join("\n");
};

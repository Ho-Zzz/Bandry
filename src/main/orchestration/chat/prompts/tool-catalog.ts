import type { ToolGuidance } from "./types";

/**
 * Comprehensive tool catalog with detailed guidance for tool selection.
 * Priority: higher values indicate more specific tools that should be preferred
 * when their conditions match.
 */
export const TOOL_CATALOG: Map<string, ToolGuidance> = new Map([
  [
    "github_search",
    {
      name: "github_search",
      description: "Search GitHub repositories, code, and issues using the GitHub API",
      whenToUse: [
        "User asks to find GitHub repositories or projects",
        "User mentions 'GitHub', 'repo', 'repository', 'open source'",
        "User asks about trending or popular projects on GitHub",
        "User wants to find similar projects or alternatives"
      ],
      whenNotToUse: [
        "User asks for general web information (use web_search)",
        "User wants to read a specific GitHub page (use web_fetch)",
        "User asks about non-GitHub code hosting"
      ],
      priority: 10
    }
  ],

  [
    "web_search",
    {
      name: "web_search",
      description: "Search the web for current information using Tavily API",
      whenToUse: [
        "User asks about current events, news, or recent developments",
        "User needs up-to-date information (prices, weather, releases)",
        "User asks 'what is the latest...' or 'current status of...'",
        "User asks about non-GitHub topics"
      ],
      whenNotToUse: [
        "User asks about GitHub repositories (use github_search)",
        "User wants to read a specific URL (use web_fetch)",
        "User asks conceptual questions answerable from knowledge"
      ],
      priority: 5
    }
  ],

  [
    "web_fetch",
    {
      name: "web_fetch",
      description: "Fetch and read content from a specific URL",
      whenToUse: [
        "User provides a specific URL to read",
        "User wants to analyze content from a webpage",
        "Following up on web_search results"
      ],
      whenNotToUse: [
        "User wants to search for information (use web_search)",
        "User asks about GitHub repos without specific URL (use github_search)"
      ],
      priority: 3
    }
  ],

  [
    "list_dir",
    {
      name: "list_dir",
      description: "List contents of a directory in the workspace",
      whenToUse: [
        "User asks what files are in a directory",
        "User wants to explore workspace structure",
        "Before reading files to verify they exist"
      ],
      whenNotToUse: [
        "User already knows the file path",
        "User asks about file contents (use read_file)"
      ],
      priority: 2
    }
  ],

  [
    "read_file",
    {
      name: "read_file",
      description: "Read contents of a file in the workspace",
      whenToUse: [
        "User asks to see file contents",
        "User wants to analyze or review code",
        "Need file content for context"
      ],
      whenNotToUse: [
        "User asks about directory structure (use list_dir)",
        "File path is unknown (use list_dir first)"
      ],
      priority: 2
    }
  ],

  [
    "exec",
    {
      name: "exec",
      description: "Execute a shell command in the sandbox",
      whenToUse: [
        "User explicitly asks to run a command",
        "User needs command output (git status, npm list, etc.)",
        "Command is in allowed list"
      ],
      whenNotToUse: [
        "Command is not in allowed list",
        "User asks about file contents (use read_file)",
        "Command requires interactive input"
      ],
      priority: 1
    }
  ],

  [
    "ask_clarification",
    {
      name: "ask_clarification",
      description: "Ask user for clarification when request is ambiguous",
      whenToUse: [
        "Request has multiple valid interpretations",
        "Missing critical information",
        "Operation is irreversible and needs confirmation",
        "User preferences are unknown and matter"
      ],
      whenNotToUse: [
        "Request is clear and unambiguous",
        "Reasonable default exists",
        "Operation is reversible"
      ],
      priority: 0
    }
  ],

  [
    "delegate_sub_tasks",
    {
      name: "delegate_sub_tasks",
      description: "Delegate complex tasks to specialized sub-agents (default mode)",
      whenToUse: [
        "Task requires multiple distinct steps",
        "Different parts need different capabilities",
        "Tasks can be parallelized"
      ],
      whenNotToUse: [
        "Simple single-step task",
        "User asks for quick answer",
        "Already in subagents mode (use task tool instead)"
      ],
      priority: 0
    }
  ],

  [
    "task",
    {
      name: "task",
      description: "Execute a sub-task using a specialized subagent (subagents mode only)",
      whenToUse: [
        "In subagents mode with complex multi-step task",
        "Task can be decomposed into parallel sub-tasks",
        "Need specialized agent capabilities"
      ],
      whenNotToUse: ["Not in subagents mode", "Task cannot be decomposed", "Simple single-step operation"],
      priority: 0
    }
  ],

  [
    "write_todos",
    {
      name: "write_todos",
      description: "Write and track task list (subagents mode only)",
      whenToUse: [
        "Planning complex multi-step work",
        "Tracking progress across multiple sub-tasks",
        "Organizing work before execution"
      ],
      whenNotToUse: ["Not in subagents mode", "Simple single-step task"],
      priority: 0
    }
  ]
]);

/**
 * Get tool guidance by name
 */
export const getToolGuidance = (toolName: string): ToolGuidance | undefined => {
  return TOOL_CATALOG.get(toolName);
};

/**
 * Get all tools sorted by priority (highest first)
 */
export const getToolsByPriority = (): ToolGuidance[] => {
  return Array.from(TOOL_CATALOG.values()).sort((a, b) => b.priority - a.priority);
};

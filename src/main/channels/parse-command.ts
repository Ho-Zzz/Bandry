import type { ChatMode } from "../../shared/ipc";

export type ChannelCommand = {
  mode: ChatMode;
  modelProfileId?: string;
  text: string;
};

const KNOWN_COMMANDS = new Set(["think", "agents", "subagents"]);

const MODE_MAP: Record<string, ChatMode> = {
  think: "thinking",
  agents: "subagents",
  subagents: "subagents",
};

export const parseChannelCommand = (raw: string): ChannelCommand => {
  let remaining = raw.trim();
  let mode: ChatMode = "default";
  let modelProfileId: string | undefined;

  // Extract commands from the beginning of the message
  while (remaining.startsWith("/")) {
    // Try /model:<profileId>
    const modelMatch = remaining.match(/^\/model:(\S+)/);
    if (modelMatch) {
      modelProfileId = modelMatch[1];
      remaining = remaining.slice(modelMatch[0].length).trimStart();
      continue;
    }

    // Try known command prefixes: /think, /agents, /subagents
    const cmdMatch = remaining.match(/^\/(\S+)/);
    if (cmdMatch && KNOWN_COMMANDS.has(cmdMatch[1])) {
      mode = MODE_MAP[cmdMatch[1]];
      remaining = remaining.slice(cmdMatch[0].length).trimStart();
      continue;
    }

    // Unknown slash — not a command, keep as-is
    break;
  }

  return { mode, modelProfileId, text: remaining };
};

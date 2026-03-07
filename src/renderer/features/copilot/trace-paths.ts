/**
 * Trace Path Utilities
 *
 * Extracts tool result metadata and file paths from chat trace messages.
 * Used by the copilot view to render clickable file links in tool result cards.
 */

export type ToolResult = {
  source: string;
  status: "success" | "failed";
  output: string;
};

/**
 * Parse a tool result trace message (e.g. "delegate_sub_tasks -> success: ...").
 * Returns null if the message does not match the expected format.
 */
export const parseToolResult = (message: string): ToolResult | null => {
  const match = message.match(/^([a-zA-Z0-9_.:-]+)\s*->\s*(success|failed)\s*:\s*([\s\S]*)$/i);
  if (!match) {
    return null;
  }

  const source = match[1]?.trim();
  const status = match[2]?.toLowerCase() === "failed" ? "failed" : "success";
  const output = match[3]?.trim() ?? "";

  if (!source) {
    return null;
  }

  return { source, status, output };
};

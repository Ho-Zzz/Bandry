/**
 * MCP (Model Context Protocol) types
 */

/**
 * MCP server configuration
 */
export type MCPServerConfig = {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
};

/**
 * MCP tool definition
 */
export type MCPTool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

/**
 * MCP server instance
 */
export type MCPServer = {
  id: string;
  config: MCPServerConfig;
  process?: unknown; // Child process
  tools: MCPTool[];
  status: "starting" | "running" | "stopped" | "error";
};

/**
 * MCP tool execution request
 */
export type MCPToolRequest = {
  tool: string;
  arguments: Record<string, unknown>;
};

/**
 * MCP tool execution response
 */
export type MCPToolResponse = {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
};

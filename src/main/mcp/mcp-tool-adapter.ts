import type { MCPTool } from "./types";
import type { ToolDefinition } from "../orchestration/tools/tool-registry";
import type { AgentRole } from "../orchestration/workflow/dag/agents/types";

/**
 * MCP Tool Adapter
 * Converts between MCP tool format and internal tool format
 */
export class MCPToolAdapter {
  /**
   * Convert MCP tool to internal tool definition
   */
  static toInternalFormat(mcpTool: MCPTool, serverId: string): ToolDefinition {
    return {
      name: mcpTool.name,
      description: mcpTool.description,
      allowedRoles: ["lead"] as AgentRole[], // MCP tools available to lead agent by default
      execute: async (args: unknown) => {
        // This will be handled by MCPRegistry.executeTool()
        return {
          serverId,
          tool: mcpTool.name,
          arguments: args as Record<string, unknown>
        };
      }
    };
  }

  /**
   * Convert internal tool definition to MCP tool format
   */
  static fromInternalFormat(tool: ToolDefinition, inputSchema: MCPTool["inputSchema"]): MCPTool {
    return {
      name: tool.name,
      description: tool.description,
      inputSchema
    };
  }

  /**
   * Validate MCP tool schema
   */
  static validateSchema(tool: MCPTool): boolean {
    if (!tool.name || typeof tool.name !== "string") {
      return false;
    }

    if (!tool.description || typeof tool.description !== "string") {
      return false;
    }

    if (!tool.inputSchema || tool.inputSchema.type !== "object") {
      return false;
    }

    if (!tool.inputSchema.properties || typeof tool.inputSchema.properties !== "object") {
      return false;
    }

    return true;
  }

  /**
   * Extract tool names from MCP tools
   */
  static extractToolNames(tools: MCPTool[]): string[] {
    return tools.map((tool) => tool.name);
  }
}

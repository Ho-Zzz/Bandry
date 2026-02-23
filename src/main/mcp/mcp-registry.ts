import { EventEmitter } from "node:events";
import type { MCPServerConfig, MCPServer, MCPTool, MCPToolRequest, MCPToolResponse } from "./types";

/**
 * MCP Registry
 * Manages MCP servers and their tools
 */
export class MCPRegistry extends EventEmitter {
  private servers: Map<string, MCPServer> = new Map();

  /**
   * Register and start an MCP server
   */
  async registerServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.id)) {
      throw new Error(`MCP server ${config.id} already registered`);
    }

    const server: MCPServer = {
      id: config.id,
      config,
      tools: [],
      status: "starting"
    };

    this.servers.set(config.id, server);

    try {
      // Start server process
      await this.startServer(server);

      // Discover tools
      await this.discoverTools(server);

      server.status = "running";
      this.emit("server:started", { serverId: config.id });
    } catch (error) {
      server.status = "error";
      this.emit("server:error", { serverId: config.id, error });
      throw error;
    }
  }

  /**
   * Unregister and stop an MCP server
   */
  async unregisterServer(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    try {
      await this.stopServer(server);
      this.servers.delete(serverId);
      this.emit("server:stopped", { serverId });
    } catch (error) {
      this.emit("server:error", { serverId, error });
      throw error;
    }
  }

  /**
   * Get all registered servers
   */
  getServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get server by ID
   */
  getServer(serverId: string): MCPServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * List all available tools across all servers
   */
  listTools(): Array<MCPTool & { serverId: string }> {
    const tools: Array<MCPTool & { serverId: string }> = [];

    for (const server of this.servers.values()) {
      if (server.status === "running") {
        for (const tool of server.tools) {
          tools.push({
            ...tool,
            serverId: server.id
          });
        }
      }
    }

    return tools;
  }

  /**
   * Execute a tool on an MCP server
   */
  async executeTool(serverId: string, request: MCPToolRequest): Promise<MCPToolResponse> {
    const server = this.servers.get(serverId);
    if (!server) {
      throw new Error(`MCP server ${serverId} not found`);
    }

    if (server.status !== "running") {
      throw new Error(`MCP server ${serverId} is not running (status: ${server.status})`);
    }

    // Check if tool exists
    const tool = server.tools.find((t) => t.name === request.tool);
    if (!tool) {
      throw new Error(`Tool ${request.tool} not found on server ${serverId}`);
    }

    try {
      // Execute tool via MCP protocol
      const response = await this.sendToolRequest(server, request);
      this.emit("tool:executed", { serverId, tool: request.tool });
      return response;
    } catch (error) {
      this.emit("tool:error", { serverId, tool: request.tool, error });
      throw error;
    }
  }

  /**
   * Start MCP server process
   */
  private async startServer(server: MCPServer): Promise<void> {
    // TODO: Implement MCP server process spawning
    // This would use child_process.spawn() to start the server
    // and establish stdio-based communication
    void server;
    console.log("[MCPRegistry] Server start not yet implemented");
  }

  /**
   * Stop MCP server process
   */
  private async stopServer(server: MCPServer): Promise<void> {
    // TODO: Implement MCP server process termination
    void server;
    console.log("[MCPRegistry] Server stop not yet implemented");
  }

  /**
   * Discover tools from MCP server
   */
  private async discoverTools(server: MCPServer): Promise<void> {
    // TODO: Implement MCP tools/list request
    // This would send a tools/list request via MCP protocol
    // and populate server.tools
    void server;
    console.log("[MCPRegistry] Tool discovery not yet implemented");
  }

  /**
   * Send tool execution request to MCP server
   */
  private async sendToolRequest(server: MCPServer, request: MCPToolRequest): Promise<MCPToolResponse> {
    // TODO: Implement MCP tools/call request
    // This would send a tools/call request via MCP protocol
    // and return the response
    void server;
    void request;
    throw new Error("MCP tool execution not yet implemented");
  }
}

import type { SandboxService } from "../../sandbox";
import type { AgentRole, ToolDefinition, ToolExecutionContext } from "../../orchestrator/multi-agent/agents/types";

export type { ToolDefinition } from "../../orchestrator/multi-agent/agents/types";

/**
 * Tool registry
 * Manages tool registration and role-based permissions
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(private sandboxService: SandboxService) {
    this.registerBuiltInTools();
  }

  /**
   * Register built-in tools
   */
  private registerBuiltInTools(): void {
    // Read-only tools (available to researcher, lead)
    this.register({
      name: "read_local_file",
      description: "Read a file from the workspace",
      allowedRoles: ["researcher", "lead", "bash_operator", "writer"],
      execute: async (args: any, _context) => {
        const result = await this.sandboxService.readFile({
          path: args.path
        });
        return result.content;
      }
    });

    this.register({
      name: "list_dir",
      description: "List directory contents",
      allowedRoles: ["researcher", "lead", "bash_operator", "writer"],
      execute: async (args: any, _context) => {
        const result = await this.sandboxService.listDir({
          path: args.path
        });
        return result.entries;
      }
    });

    // Write tools (available to writer, bash_operator)
    this.register({
      name: "write_to_file",
      description: "Write content to a file",
      allowedRoles: ["writer", "bash_operator"],
      execute: async (args: any, _context) => {
        const result = await this.sandboxService.writeFile({
          path: args.path,
          content: args.content,
          createDirs: true,
          overwrite: args.overwrite ?? false
        });
        return { path: result.path };
      }
    });

    // Execution tools (available to bash_operator only)
    this.register({
      name: "execute_bash",
      description: "Execute a bash command",
      allowedRoles: ["bash_operator"],
      execute: async (args: any, context) => {
        const result = await this.sandboxService.exec({
          command: args.command,
          args: args.args || [],
          cwd: args.cwd || context.workspacePath
        });
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode
        };
      }
    });
  }

  /**
   * Register a tool
   */
  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get tool by name
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools available for a role
   */
  getToolsForRole(role: AgentRole): ToolDefinition[] {
    return Array.from(this.tools.values()).filter((tool) =>
      tool.allowedRoles.includes(role)
    );
  }

  /**
   * Check if role can use tool
   */
  canRoleUseTool(role: AgentRole, toolName: string): boolean {
    const tool = this.tools.get(toolName);
    return tool ? tool.allowedRoles.includes(role) : false;
  }

  /**
   * Execute a tool
   */
  async executeTool(
    toolName: string,
    args: unknown,
    context: ToolExecutionContext
  ): Promise<unknown> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    if (!tool.allowedRoles.includes(context.agentRole)) {
      throw new Error(
        `Role ${context.agentRole} is not allowed to use tool ${toolName}`
      );
    }

    return await tool.execute(args, context);
  }

  /**
   * Get all tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.tools.size;
  }
}

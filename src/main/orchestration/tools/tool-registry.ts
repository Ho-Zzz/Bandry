import type { SandboxService } from "../../sandbox";
import type { AgentRole, ToolDefinition, ToolExecutionContext } from "../workflow/dag/agents/types";

export type { ToolDefinition } from "../workflow/dag/agents/types";

/**
 * Tool registry
 * Manages tool registration and role-based permissions
 */
export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  constructor(private sandboxService: SandboxService) {
    this.registerBuiltInTools();
  }

  private readPathArg(args: unknown): string {
    const record = (typeof args === "object" && args !== null ? args : {}) as Record<string, unknown>;
    const value = record.path;
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error("Tool argument 'path' must be a non-empty string");
    }
    return value;
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
      execute: async (args, context) => {
        void context;
        const result = await this.sandboxService.readFile({
          path: this.readPathArg(args)
        });
        return result.content;
      }
    });

    this.register({
      name: "list_dir",
      description: "List directory contents",
      allowedRoles: ["researcher", "lead", "bash_operator", "writer"],
      execute: async (args, context) => {
        void context;
        const result = await this.sandboxService.listDir({
          path: this.readPathArg(args)
        });
        return result.entries;
      }
    });

    // Write tools (available to writer, bash_operator)
    this.register({
      name: "write_to_file",
      description: "Write content to a file",
      allowedRoles: ["writer", "bash_operator"],
      execute: async (args, context) => {
        void context;
        const record = (typeof args === "object" && args !== null ? args : {}) as Record<string, unknown>;
        const path = this.readPathArg(record);
        const content =
          typeof record.content === "string" ? record.content : JSON.stringify(record.content ?? "", null, 2);
        const result = await this.sandboxService.writeFile({
          path,
          content,
          createDirs: true,
          overwrite: record.overwrite === true
        });
        return { path: result.path };
      }
    });

    // Execution tools (available to bash_operator only)
    this.register({
      name: "execute_bash",
      description: "Execute a bash command",
      allowedRoles: ["bash_operator"],
      execute: async (args, context) => {
        const record = (typeof args === "object" && args !== null ? args : {}) as Record<string, unknown>;
        const command = typeof record.command === "string" ? record.command : "ls";
        const rawArgs = Array.isArray(record.args) ? record.args : [];
        const parsedArgs = rawArgs.filter((item): item is string => typeof item === "string");
        const cwd = typeof record.cwd === "string" ? record.cwd : context.workspacePath;
        const result = await this.sandboxService.exec({
          command,
          args: parsedArgs,
          cwd
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

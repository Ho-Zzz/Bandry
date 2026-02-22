import type { AppConfig } from "../../../config";
import type { ModelsFactory } from "../../../models";
import type { AgentRole, AgentConfig, AgentResult, AgentExecutionInput } from "./types";

/**
 * Base agent class
 * Provides common functionality for all agents
 */
export abstract class BaseAgent {
  protected config: AgentConfig;

  constructor(
    protected appConfig: AppConfig,
    protected modelsFactory: ModelsFactory,
    config: Partial<AgentConfig>
  ) {
    this.config = {
      role: this.getRole(),
      workspacePath: config.workspacePath || "",
      allowedTools: config.allowedTools || this.getDefaultTools(),
      systemPrompt: config.systemPrompt || this.getDefaultSystemPrompt()
    };
  }

  /**
   * Get agent role (must be implemented by subclass)
   */
  protected abstract getRole(): AgentRole;

  /**
   * Get default tools for this agent
   */
  protected abstract getDefaultTools(): string[];

  /**
   * Get default system prompt for this agent
   */
  protected abstract getDefaultSystemPrompt(): string;

  /**
   * Execute agent task (must be implemented by subclass)
   */
  abstract execute(input: AgentExecutionInput): Promise<AgentResult>;

  /**
   * Check if agent has permission to use a tool
   */
  protected canUseTool(toolName: string): boolean {
    return this.config.allowedTools.includes(toolName);
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * Update workspace path
   */
  setWorkspacePath(workspacePath: string): void {
    this.config.workspacePath = workspacePath;
  }

  /**
   * Format error result
   */
  protected errorResult(error: string): AgentResult {
    return {
      success: false,
      output: "",
      error
    };
  }

  /**
   * Format success result
   */
  protected successResult(output: string, artifacts?: string[]): AgentResult {
    return {
      success: true,
      output,
      artifacts
    };
  }
}
